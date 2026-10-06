import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useDemo } from "./demo-context";
import {
  cashErrors,
  cashTotals,
  cents,
  dateLabel,
  emptyDraft,
  exampleDraft,
  methods,
  money,
  units,
  type CashDraft,
} from "./data";
import { unitSalesSummary } from "./unit-sales";
import { upsertByDate } from "./local-state";
import { Back, Badge, Icon, Note, RowLink } from "./ui";
import { RealCashDetail, RealHistoryList } from "./Real";
const stepPaths = [
  "/caixa/novo",
  "/caixa/novo/unidades",
  "/caixa/novo/saidas",
  "/caixa/novo/conferencia",
];
const stepNames = ["Recebimentos", "Unidades", "Saídas", "Conferência"];
const history = [
  { id: "04", draft: { ...exampleDraft("regular"), date: "2026-10-04" } },
  { id: "03", draft: { ...exampleDraft("diferenca"), date: "2026-10-03" } },
  { id: "02", draft: { ...exampleDraft("regular"), date: "2026-10-02" } },
];
function AmountInput({
  label,
  value,
  onChange,
  color,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  color?: string;
  required?: boolean;
}) {
  const invalid = !!value.trim() && cents(value) === null;
  return (
    <label className={`amount-field ${invalid ? "invalid" : ""}`}>
      <span>
        {color ? (
          <i className="unit-dot" style={{ background: color }} />
        ) : null}
        {label}
        {required ? " *" : ""}
      </span>
      <span className="currency-input">
        <span aria-hidden="true">R$</span>
        <input
          aria-label={label}
          value={value}
          inputMode="decimal"
          placeholder="—"
          enterKeyHint="next"
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          required={required}
        />
      </span>
      {invalid ? <small>Use um valor positivo, como 1.420,00.</small> : null}
    </label>
  );
}
export function Cash() {
  const {
    draft,
    setDraft,
    closed,
    setClosed,
    scenario,
    setProfile,
    cashRecords,
  } = useDemo();
  const hasDraft =
    draft.responsible !== "" ||
    draft.sales !== "" ||
    Object.values(draft.receipts).some(Boolean);
  return (
    <>
      <span className="eyebrow">PRIMEIRA ROTINA DIGITAL</span>
      <h1>Caixa e conferência</h1>
      <p>Represente o fechamento que a equipe já faz.</p>
      <Note>
        Simulação local, sem envio ao servidor. Rascunho recuperável ao
        recarregar esta aba. Apague os dados em Mais ao terminar em dispositivo
        compartilhado.
      </Note>
      <section className="panel">
        <h2>Entrada simples por unidade</h2>
        <p>Data e totais vendidos nas seis unidades.</p>
        <Link
          className="primary"
          to="/caixa/vendas"
          onClick={() => setProfile("caixa")}
        >
          Informar vendas por unidade <Icon name="arrow" size={16} />
        </Link>
      </section>
      {closed ? (
        <section className="panel">
          <div className="section-title">
            <h2>Simulação concluída</h2>
            <Icon name="check" />
          </div>
          <RowLink
            to="/caixa/concluido"
            title={dateLabel(closed.date)}
            subtitle={closed.responsible}
            value={money(cashTotals(closed).receipts / 100)}
          />
          <button
            className="secondary"
            onClick={() => {
              setClosed(null);
              setDraft(emptyDraft());
            }}
          >
            Preparar nova simulação
          </button>
        </section>
      ) : (
        <section className="hero cash-start">
          <span className="eyebrow">
            {draft.date ? dateLabel(draft.date) : "DATA NÃO INFORMADA"} ·
            SIMULAÇÃO
          </span>
          <h2>
            {hasDraft ? "Seu rascunho está aqui." : "Vamos fechar o dia?"}
          </h2>
          <p>
            {hasDraft
              ? "Continue de onde parou nesta sessão."
              : "Recebimentos, unidades, saídas e conferência em uma sequência simples."}
          </p>
          <Link className="primary gold" to="/caixa/novo">
            {hasDraft ? "Continuar rascunho" : "Iniciar fechamento"}{" "}
            <Icon name="arrow" size={16} />
          </Link>
        </section>
      )}
      {cashRecords.length ? (
        <section className="panel">
          <h2>Fechamentos locais · simulação</h2>
          {cashRecords.map((r) => (
            <RowLink
              key={r.localId}
              to={`/caixa/historico/local-${r.localId}`}
              title={dateLabel(r.date)}
              subtitle="Registrado nesta aba · editar disponível"
            />
          ))}
        </section>
      ) : null}
      {scenario === "diferenca" ? (
        <Note tone="warning">
          Cenário selecionado: diferença de R$ 32,00. Dentro do fechamento, use
          “Preencher exemplo fictício” para explorar.
        </Note>
      ) : null}
      {scenario === "real" ? (
        <RealHistoryList />
      ) : (
        <h2>Histórico de exemplo</h2>
      )}
      {scenario === "real" ? null : scenario === "vazio" ? (
        <section className="panel">
          <p>
            Nenhum fechamento neste cenário. Você pode iniciar uma simulação
            acima.
          </p>
        </section>
      ) : (
        <div className="panel compact">
          {history.map((h) => {
            const t = cashTotals(h.draft);
            return (
              <RowLink
                key={h.id}
                to={`/caixa/historico/${h.id}`}
                title={dateLabel(h.draft.date)}
                subtitle={
                  t.difference === 0
                    ? "Sem diferença · fictício"
                    : `Diferença ${money((t.difference ?? 0) / 100)} · fictício`
                }
                value={money(t.receipts / 100)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
export function CashFlow({ step }: { step: number }) {
  const {
    draft,
    setDraft,
    closed,
    setClosed,
    scenario,
    unitSalesRecords,
    unitSalesDraft,
    setCashRecords,
    setUnitSalesRecords,
    setUnitSalesDraft,
    setUnitSalesRecord,
    localSaved,
  } = useDemo();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const t = cashTotals(draft);
  useEffect(() => {
    setErrors([]);
  }, [step]);
  useEffect(() => {
    if (errors.length) errorRef.current?.focus();
  }, [errors]);
  const update = (patch: Partial<CashDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));
  if (closed) return <Navigate to="/caixa/concluido" replace />;
  function next() {
    const validation =
      step === 1
        ? cashErrors({ ...draft, units: emptyDraft().units, outflows: [] })
        : step === 2
          ? Object.values(draft.units).some((v) => cents(v) === null)
            ? ["Revise os valores das unidades."]
            : []
          : step === 3
            ? cashErrors(draft).filter((e) => e.startsWith("Preencha"))
            : cashErrors(draft);
    if (validation.length) {
      setErrors(validation);
      return;
    }
    if (step === 4) {
      const completed = {
        ...structuredClone(draft),
        localId: draft.localId || crypto.randomUUID(),
      };
      setClosed(completed);
      setCashRecords((current) => [
        ...current.filter((r) => r.localId !== completed.localId),
        completed,
      ]);
      const shared = {
        date: draft.date,
        values: draft.units as typeof unitSalesDraft.values,
      };
      const summary = unitSalesSummary(shared);
      if (summary.total !== null) {
        const record = {
          date: draft.date,
          values: summary.values,
          total: summary.total,
          count: summary.count,
        };
        setUnitSalesRecords((current) => upsertByDate(current, record));
        setUnitSalesDraft(shared);
        setUnitSalesRecord(record);
      }
      navigate("/caixa/concluido", { replace: true });
    } else navigate(stepPaths[step]);
  }
  return (
    <>
      <Back to={step === 1 ? "/caixa" : stepPaths[step - 2]}>
        {step === 1 ? "Caixa" : stepNames[step - 2]}
      </Back>
      <span className="eyebrow">SIMULAÇÃO · ETAPA {step} DE 4</span>
      <ol className="stepper" aria-label="Etapas do fechamento">
        {stepNames.map((name, i) => (
          <li
            key={name}
            className={i + 1 === step ? "current" : i + 1 < step ? "done" : ""}
            aria-current={i + 1 === step ? "step" : undefined}
          >
            <span>
              {i + 1 < step ? <Icon name="check" size={14} /> : i + 1}
            </span>
            <small>{name}</small>
          </li>
        ))}
      </ol>
      <h1>{stepNames[step - 1]}</h1>
      {errors.length ? (
        <div className="form-errors" role="alert" tabIndex={-1} ref={errorRef}>
          <b>Revise antes de continuar</b>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {step > 1 ? (
            <Link to="/caixa/novo">Editar dados e recebimentos</Link>
          ) : null}
        </div>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
        noValidate
      >
        {step === 1 ? (
          <>
            <p>
              Transcreva os recebimentos do fechamento. * Campos necessários
              para esta simulação.
            </p>
            <Note>
              Simulação local. O rascunho é recuperável ao recarregar esta aba.
            </Note>
            <details className="panel">
              <summary>Exemplo fictício para demonstração</summary>
              <div className="example-control">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setDraft(exampleDraft(scenario));
                    setErrors([]);
                  }}
                >
                  Preencher exemplo fictício
                  {scenario === "diferenca" ? " com diferença" : ""}
                </button>
                <small>
                  Substitui todos os campos do rascunho pelos dados do exemplo.
                </small>
              </div>
            </details>
            <section className="panel form-panel">
              <h2>Dados do fechamento</h2>
              <label className="text-field">
                Data *
                <input
                  type="date"
                  value={draft.date}
                  min="2000-01-01"
                  max="2099-12-31"
                  onChange={(e) => update({ date: e.target.value })}
                />
              </label>
              <label className="text-field">
                Responsável pelo fechamento *
                <input
                  value={draft.responsible}
                  autoComplete="off"
                  placeholder="Nome do responsável"
                  onChange={(e) => update({ responsible: e.target.value })}
                />
              </label>
              <label className="text-field">
                Conferente <small>Opcional no protótipo</small>
                <input
                  value={draft.reviewer}
                  autoComplete="off"
                  placeholder="Nome de quem conferiu"
                  onChange={(e) => update({ reviewer: e.target.value })}
                />
              </label>
            </section>
            <h2>Referência de vendas</h2>
            <AmountInput
              label="Total de vendas"
              value={draft.sales}
              required
              onChange={(sales) => update({ sales })}
            />
            <h2>Formas de recebimento</h2>
            {methods.map((m) => (
              <AmountInput
                key={m}
                label={m}
                value={draft.receipts[m]}
                onChange={(value) =>
                  update({ receipts: { ...draft.receipts, [m]: value } })
                }
              />
            ))}
            <div className="total-strip" aria-live="polite">
              <span>
                {t.receiptCount < 6 ? "Total parcial" : "Total registrado"} ·{" "}
                {t.receiptCount}/6 <Badge kind="calculado" />
              </span>
              <strong>
                {t.receiptCount ? money(t.receipts / 100) : "Não informado"}
              </strong>
            </div>
          </>
        ) : step === 2 ? (
          <>
            <p>
              Confira os valores por unidade. A referência de vendas permanece
              independente.
            </p>
            {(() => {
              const saved = unitSalesRecords.find((r) => r.date === draft.date);
              const source = saved
                ? Object.fromEntries(
                    Object.entries(saved.values).map(([id, v]) => [
                      id,
                      v === null ? "" : (v / 100).toFixed(2),
                    ]),
                  )
                : unitSalesDraft.date === draft.date
                  ? unitSalesDraft.values
                  : null;
              return source ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => update({ units: { ...source } })}
                >
                  Reaproveitar vendas de {dateLabel(draft.date)}
                </button>
              ) : null;
            })()}
            <Note>
              As unidades representam a origem da receita. Sem rateio de
              despesas ou custos. Se ainda não houver separação por unidade,
              deixe os campos em branco.
            </Note>
            {units.map((u) => (
              <AmountInput
                key={u.id}
                label={u.name}
                value={draft.units[u.id]}
                onChange={(value) =>
                  update({ units: { ...draft.units, [u.id]: value } })
                }
              />
            ))}
            <div className="total-strip">
              <span>
                Total {t.unitCount < 6 ? "parcial " : ""}por unidade ·{" "}
                {t.unitCount}/6
              </span>
              <strong>
                {t.unitCount ? money(t.mix / 100) : "Não informado"}
              </strong>
            </div>
            {t.unitCount < 6 ? (
              <Note>
                Cobertura de {t.unitCount}/6 unidades.{" "}
                {t.unitCount
                  ? "Soma parcial; não permite conferir a distribuição completa."
                  : "Distribuição não informada."}
              </Note>
            ) : t.mix !== t.sales ? (
              <Note tone="warning">
                {t.unitCount === 0
                  ? "Sem distribuição por unidade informada."
                  : `O total por unidade difere das vendas em ${money((t.mix - t.sales) / 100)}.`}{" "}
                A diferença fica visível para conferência, sem criar uma regra
                de bloqueio.
              </Note>
            ) : (
              <Note tone="success">
                O total por unidade corresponde às vendas informadas.
              </Note>
            )}
          </>
        ) : step === 3 ? (
          <>
            <p>Registre as saídas que constam no fechamento atual.</p>
            <Note>
              As saídas são apresentadas separadamente. O tratamento delas na
              diferença do caixa precisa ser confirmado com Higor.
            </Note>
            {draft.outflows.length === 0 ? (
              <section className="empty-small panel">
                <Icon name="document" />
                <h2>Nenhuma saída informada</h2>
                <p>
                  Adicione uma saída se houver registro no dia, ou continue.
                </p>
              </section>
            ) : (
              draft.outflows.map((o, i) => (
                <section className="panel outflow" key={o.id}>
                  <div className="row">
                    <h2>Saída {i + 1}</h2>
                    <button
                      type="button"
                      className="text-link"
                      aria-label={`Remover saída ${i + 1}`}
                      onClick={() =>
                        update({
                          outflows: draft.outflows.filter((v) => v.id !== o.id),
                        })
                      }
                    >
                      Remover
                    </button>
                  </div>
                  <label className="text-field">
                    Descrição / referência do documento
                    <input
                      value={o.description}
                      placeholder="Descrição conforme o fechamento"
                      onChange={(e) =>
                        update({
                          outflows: draft.outflows.map((v) =>
                            v.id === o.id
                              ? { ...v, description: e.target.value }
                              : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <AmountInput
                    label={`Valor da saída ${i + 1}`}
                    value={o.amount}
                    onChange={(amount) =>
                      update({
                        outflows: draft.outflows.map((v) =>
                          v.id === o.id ? { ...v, amount } : v,
                        ),
                      })
                    }
                  />
                </section>
              ))
            )}
            <button
              type="button"
              className="secondary"
              onClick={() =>
                update({
                  outflows: [
                    ...draft.outflows,
                    {
                      id: Math.max(0, ...draft.outflows.map((o) => o.id)) + 1,
                      description: "",
                      amount: "",
                    },
                  ],
                })
              }
            >
              + Adicionar saída
            </button>
            <div className="total-strip">
              <span>Saídas informadas</span>
              <strong>{money(t.outflows / 100)}</strong>
            </div>
            <label className="text-field">
              Observações
              <textarea
                rows={3}
                value={draft.notes}
                placeholder="Informações que ajudam a conferir o dia"
                onChange={(e) => update({ notes: e.target.value })}
              />
            </label>
          </>
        ) : (
          <>
            <p>
              Confira os valores e responsáveis antes de concluir a simulação.
            </p>
            <CashSummary draft={draft} />
            <div className="edit-links">
              <Link to={stepPaths[0]}>Editar recebimentos</Link>
              <Link to={stepPaths[1]}>Editar unidades</Link>
              <Link to={stepPaths[2]}>Editar saídas</Link>
            </div>
            <Note>
              Ao confirmar, o fechamento ficará disponível apenas nesta sessão.
              Nenhum dado será enviado para a operação real.
            </Note>
          </>
        )}
        <div className="flow-actions">
          <button className="primary" type="submit">
            {step === 4
              ? "Concluir simulação"
              : step === 3
                ? "Conferir fechamento"
                : "Continuar"}{" "}
            <Icon name={step === 4 ? "check" : "arrow"} size={18} />
          </button>
          <p className="hint" role="status">
            {localSaved
              ? "Salvo nesta aba · recuperável ao recarregar · sem envio ao servidor"
              : "Armazenamento indisponível · rascunho somente em memória"}
          </p>
          <Link className="save-draft" to="/caixa">
            Sair e manter rascunho nesta sessão
          </Link>
        </div>
      </form>
    </>
  );
}
function CashSummary({ draft }: { draft: CashDraft }) {
  const t = cashTotals(draft);
  const errors = cashErrors(draft);
  const invalid = errors.length > 0 || t.difference === null;
  return (
    <>
      <dl className="panel fact-list">
        <div>
          <dt>Data</dt>
          <dd>{draft.date ? dateLabel(draft.date) : "Não informada"}</dd>
        </div>
        <div>
          <dt>Responsável</dt>
          <dd>{draft.responsible || "Não informado"}</dd>
        </div>
        <div>
          <dt>Conferente</dt>
          <dd>{draft.reviewer || "Não informado"}</dd>
        </div>
      </dl>
      <section className="panel">
        <div className="section-title">
          <h2>Recebimentos</h2>
          <Badge kind="observado" />
        </div>
        {methods.map((m) => (
          <div className="summary-row" key={m}>
            <span>{m}</span>
            <b>
              {!draft.receipts[m].trim()
                ? "Não informado"
                : cents(draft.receipts[m]) === null
                  ? "Valor inválido"
                  : money((cents(draft.receipts[m]) ?? 0) / 100)}
            </b>
          </div>
        ))}
        <div className="summary-row total-row">
          <span>
            {t.receiptCount < 6
              ? "Total parcial de recebimentos"
              : "Total registrado"}{" "}
            · {t.receiptCount}/6
          </span>
          <b>{t.receiptCount ? money(t.receipts / 100) : "Não informado"}</b>
        </div>
        <div className="summary-row">
          <span>Total de vendas</span>
          <b>
            {cents(draft.sales) === null || !draft.sales
              ? "Não informado / inválido"
              : money(t.sales / 100)}
          </b>
        </div>
      </section>
      <section
        className={`difference ${invalid || t.difference !== 0 ? "warning" : "success"}`}
        aria-live="polite"
      >
        <span className="eyebrow">DIFERENÇA DEMONSTRATIVA</span>
        <strong>
          {invalid ? "A conferir" : money((t.difference ?? 0) / 100)}
        </strong>
        <span>
          {invalid
            ? "Há campos incompletos ou inválidos."
            : t.difference === 0
              ? "Recebimentos correspondem às vendas informadas."
              : (t.difference ?? 0) < 0
                ? "Recebimentos abaixo das vendas informadas."
                : "Recebimentos acima das vendas informadas."}
        </span>
      </section>
      <p className="hint">
        Comparação ilustrativa: recebimentos − vendas. As saídas não foram
        abatidas. Validar a fórmula e os conceitos de total registrado e vendas
        com Higor.
      </p>
      <section className="panel">
        <h2>Receita por unidade de negócio · {t.unitCount}/6</h2>
        {t.unitCount === 0 ? (
          <p>Distribuição não informada.</p>
        ) : (
          units.map((u) => (
            <div className="summary-row" key={u.id}>
              <span>{u.name}</span>
              <b>
                {!draft.units[u.id].trim()
                  ? "Não informado"
                  : cents(draft.units[u.id]) === null
                    ? "Valor inválido"
                    : money((cents(draft.units[u.id]) ?? 0) / 100)}
              </b>
            </div>
          ))
        )}
        {t.unitCount < 6 ? (
          <Note>Distribuição parcial. Ausência não representa zero.</Note>
        ) : t.mix !== t.sales ? (
          <Note tone="warning">
            Distribuição por unidade ainda não corresponde ao total de vendas.
          </Note>
        ) : null}
      </section>
      <section className="panel">
        <h2>Saídas · {money(t.outflows / 100)}</h2>
        {draft.outflows.length ? (
          draft.outflows.map((o) => (
            <div className="summary-row" key={o.id}>
              <span>{o.description || "Descrição não informada"}</span>
              <b>
                {cents(o.amount) === null
                  ? "Valor inválido"
                  : money((cents(o.amount) ?? 0) / 100)}
              </b>
            </div>
          ))
        ) : (
          <p>Nenhuma saída informada.</p>
        )}
        {draft.notes ? (
          <>
            <h2>Observações</h2>
            <p className="preserve-lines">{draft.notes}</p>
          </>
        ) : null}
      </section>
    </>
  );
}
export function CashSuccess() {
  const { closed } = useDemo();
  if (!closed) return <Navigate to="/caixa" replace />;
  return (
    <>
      <Back to="/caixa">Caixa</Back>
      <section className="completion">
        <span className="completion-icon">
          <Icon name="check" size={34} />
        </span>
        <span className="eyebrow">SIMULAÇÃO CONCLUÍDA</span>
        <h1>
          Mais clareza
          <br />
          para fechar o dia.
        </h1>
        <p>Fechamento de {dateLabel(closed.date)} disponível nesta sessão.</p>
      </section>
      <Note tone="success">
        Seus valores foram usados na conferência. Nenhum dado foi enviado ou
        salvo permanentemente.
      </Note>
      <CashSummary draft={closed} />
      <Link className="primary" to="/">
        Voltar à visão geral
      </Link>
    </>
  );
}
export function CashHistory() {
  const { id } = useParams();
  const { cashRecords, setDraft, setClosed } = useDemo();
  if (id?.startsWith("real-")) return <RealCashDetail id={id} />;
  const local = cashRecords.find((r) => `local-${r.localId}` === id);
  const record = local
    ? { id: id!, draft: local }
    : history.find((h) => h.id === id);
  return (
    <>
      <Back to="/caixa">Histórico do caixa</Back>
      <h1>
        {record
          ? `Fechamento · ${dateLabel(record.draft.date)}`
          : "Fechamento não encontrado"}
      </h1>
      {record ? (
        <>
          <Note>
            {local
              ? "Fechamento registrado localmente na simulação."
              : "Fechamento inteiramente fictício de exemplo."}
          </Note>
          <CashSummary draft={record.draft} />
          {local ? (
            <Link
              className="secondary"
              to="/caixa/novo"
              onClick={() => {
                setDraft(structuredClone(local));
                setClosed(null);
              }}
            >
              Editar fechamento local
            </Link>
          ) : (
            <details className="document-panel">
              <summary>
                <Icon name="document" />
                Documento de exemplo
              </summary>
              <div className="document-preview">
                <span className="document-watermark">FICTÍCIO</span>
                <h2>Livro de fechamento · DEMO-{id}</h2>
                <p>Data: {dateLabel(record.draft.date)}</p>
                <p>Responsável: {record.draft.responsible}</p>
                <p>
                  Total de recebimentos:{" "}
                  {money(cashTotals(record.draft).receipts / 100)}
                </p>
                <p className="hint">
                  Representação textual de exemplo. Não é um documento original.
                </p>
              </div>
            </details>
          )}
        </>
      ) : (
        <p>Use o histórico para escolher um fechamento disponível.</p>
      )}
    </>
  );
}
