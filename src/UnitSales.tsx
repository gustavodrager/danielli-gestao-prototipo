import { useEffect, useRef, useState } from "react";
import { useDemo } from "./demo-context";
import { money, units, dateLabel, cents } from "./data";
import {
  emptyUnitSales,
  unitSalesErrors,
  unitSalesSummary,
  paymentMethods,
  feeMethods,
  recordToDraft,
  makeUnitSalesRecord,
  type UnitId,
  type UnitSalesDraft,
} from "./unit-sales";
import { Icon } from "./ui";
import { Link } from "./navigation";
const amount = (value: number | null | undefined) =>
  value == null ? "A conferir" : money(value / 100);
function Totals({ draft }: { draft: UnitSalesDraft }) {
  const s = unitSalesSummary(draft);
  return (
    <section className="payment-totals" aria-live="polite" aria-atomic="true">
      <div>
        <span>
          Total bruto {s.completeCount < 6 ? "· parcial" : ""}
          <small>
            {s.receiptCount}/24 recebimentos · {s.completeCount}/6 unidades
            completas
          </small>
        </span>
        <strong>{amount(s.total)}</strong>
      </div>
      <div>
        <span>Taxas {s.netCount < 6 ? "· unidades calculáveis" : ""}</span>
        <strong>{amount(s.feesTotal ?? s.partialFees)}</strong>
      </div>
      <div className="net-total">
        <span>
          {s.netCount === 6 ? "Líquido após taxas" : "Líquido parcial"}
          <small>
            {s.netCount}/6 unidades com líquido calculável · não é lucro
          </small>
        </span>
        <strong>{amount(s.netTotal ?? s.partialNet)}</strong>
      </div>
    </section>
  );
}
export default function UnitSales() {
  const {
    unitSalesDraft: draft,
    setUnitSalesDraft: setDraft,
    unitSalesRecord: record,
    setUnitSalesRecord: setRecord,
    unitSalesRecords: records,
    selectUnitSalesRecord,
    feeRates,
    localSaved,
    setProfile,
  } = useDemo();
  useEffect(() => setProfile("caixa"), [setProfile]);
  const [active, setActive] = useState<UnitId>("balcao");
  const [review, setReview] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof unitSalesErrors>>([]);
  const focusRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const s = unitSalesSummary(draft);
  const current = s.unitSummaries.find((u) => u.id === active)!;
  const index = units.findIndex((u) => u.id === active);
  useEffect(() => {
    if (review || record) focusRef.current?.focus();
  }, [review, record]);
  useEffect(() => {
    if (errors.length) errorRef.current?.focus();
  }, [errors]);
  function edit(unit: UnitId = active, restoreRecord = true) {
    if (record && restoreRecord) setDraft(recordToDraft(record));
    setRecord(null);
    setReview(false);
    setErrors([]);
    setActive(unit);
  }
  const displayDraft = record?.receipts ? recordToDraft(record) : draft;
  const displaySummary = unitSalesSummary(displayDraft);
  const legacy = record && !record.receipts;
  function goToError(field: string) {
    const unit = units.find((u) => field.startsWith(`unit-sales-${u.id}-`));
    if (unit) setActive(unit.id);
    setReview(false);
    requestAnimationFrame(() => {
      const input = document.getElementById(field);
      const details = input?.closest("details");
      if (details) details.open = true;
      input?.focus();
    });
  }
  return (
    <div className="unit-entry">
      <span className="eyebrow">CAIXA · RECEBIMENTOS DO DIA</span>
      <h1>Vendas por unidade</h1>
      <p>
        Escolha a unidade e digite os valores recebidos. Os totais são
        calculados para você.
      </p>
      {errors.length ? (
        <div ref={errorRef} className="form-errors" role="alert" tabIndex={-1}>
          <b>Revise os campos</b>
          <ul>
            {errors.map((e) => (
              <li key={e.field}>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => goToError(e.field)}
                >
                  {e.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {record || review ? (
        <>
          <section
            ref={focusRef}
            tabIndex={-1}
            className="panel unit-confirmation"
            aria-label={record ? "Valores confirmados" : "Revisar recebimentos"}
          >
            <h2>
              {record ? "Valores confirmados" : "Confira antes de confirmar"}
            </h2>
            <p>
              {dateLabel(record?.date ?? draft.date)} ·{" "}
              {record
                ? "Simulação local"
                : "Você pode confirmar com pendências identificadas."}
            </p>
            {displayDraft.legacyTotals ? (
              <details className="note">
                <summary>Totais do registro antigo preservados</summary>
                <p>
                  Referência anterior, sem detalhamento por recebimento. O novo
                  preenchimento fica separado dessa referência.
                </p>
                {units.map((u) => (
                  <p key={u.id}>
                    {u.name}: {amount(displayDraft.legacyTotals!.values[u.id])}
                  </p>
                ))}
                <b>Total anterior: {amount(displayDraft.legacyTotals.total)}</b>
              </details>
            ) : null}
            {legacy ? (
              <>
                <div className="note">
                  Registro antigo · sem detalhamento por recebimento. Totais
                  preservados; taxas e líquido não conhecidos.
                </div>
                <dl className="fact-list">
                  {units.map((u) => (
                    <div key={u.id}>
                      <dt>{u.name}</dt>
                      <dd>
                        {record.values[u.id] === null
                          ? "Não informado"
                          : amount(record.values[u.id])}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="total-strip">
                  <span>Total bruto informado</span>
                  <strong>{amount(record.total)}</strong>
                </div>
              </>
            ) : (
              <>
                {displaySummary.unitSummaries.map((u) => (
                  <div className="review-unit" key={u.id}>
                    <div className="section-title">
                      <h3>{units.find((unit) => unit.id === u.id)!.name}</h3>
                      <button
                        className="text-link"
                        type="button"
                        onClick={() => edit(u.id)}
                      >
                        Editar {units.find((unit) => unit.id === u.id)!.name}
                      </button>
                    </div>
                    {u.count ? (
                      <>
                        <div className="summary-row">
                          <span>Bruto {u.complete ? "" : "· parcial"}</span>
                          <b>{amount(u.gross)}</b>
                        </div>
                        <div className="summary-row">
                          <span>Taxas</span>
                          <b>{amount(u.fees)}</b>
                        </div>
                        <div className="summary-row">
                          <span>Líquido após taxas</span>
                          <b>{amount(u.net)}</b>
                        </div>
                      </>
                    ) : (
                      <p className="muted">Não informado</p>
                    )}
                    {u.count ? (
                      <details>
                        <summary>Ver recebimentos · {u.count}/4</summary>
                        <dl>
                          {paymentMethods.map((m) => (
                            <div className="summary-row" key={m.id}>
                              <dt>{m.name}</dt>
                              <dd>
                                {displaySummary.receipts[u.id][m.id] === null
                                  ? "Não informado"
                                  : amount(displaySummary.receipts[u.id][m.id])}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    ) : null}
                    {!u.complete || u.missingRates.length ? (
                      <small className="pending-label">
                        {4 - u.count} recebimentos pendentes
                        {u.missingRates.length
                          ? ` · taxas pendentes: ${u.missingRates.join(", ")}`
                          : ""}
                      </small>
                    ) : null}
                  </div>
                ))}
                <details className="rates-reference">
                  <summary>Taxas usadas neste registro</summary>
                  {feeMethods.map((m) => (
                    <p key={m}>
                      {paymentMethods.find((p) => p.id === m)!.name}:{" "}
                      {displayDraft.rates?.[m]
                        ? `${displayDraft.rates[m]}%`
                        : "Não informada"}
                    </p>
                  ))}
                </details>
                <Totals draft={displayDraft} />
              </>
            )}
            <p className="hint">
              {record
                ? "Confirmado apenas nesta aba. O histórico real permanece separado."
                : "Campos em branco permanecem pendentes; não são zero."}
            </p>
          </section>
          {!record ? (
            <button
              type="button"
              className="primary"
              onClick={() => {
                const next = unitSalesErrors(draft);
                setErrors(next);
                if (!next.length) {
                  setRecord(makeUnitSalesRecord(draft));
                  setReview(false);
                }
              }}
            >
              Confirmar{" "}
              {s.completeCount === 6 && s.netCount === 6
                ? "recebimentos"
                : "lançamento parcial"}{" "}
              <Icon name="check" size={18} />
            </button>
          ) : null}
          <button
            type="button"
            className="secondary unit-new"
            onClick={() => edit()}
          >
            Voltar e editar valores
          </button>
          {record ? (
            <button
              type="button"
              className="secondary unit-new"
              onClick={() => {
                setDraft(emptyUnitSales(feeRates));
                edit("balcao", false);
              }}
            >
              Novo preenchimento
            </button>
          ) : null}
        </>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const next = unitSalesErrors(draft);
            setErrors(next);
            if (!next.length) setReview(true);
          }}
        >
          {draft.legacyTotals ? (
            <p className="note">
              Informe os recebimentos conhecidos. Os totais antigos ficam
              guardados como referência separada, sem distribuição presumida.
            </p>
          ) : null}
          <label className="text-field">
            Data das vendas
            <input
              id="unit-sales-date"
              type="date"
              required
              aria-invalid={errors.some((e) => e.field === "unit-sales-date")}
              value={draft.date}
              onInput={(e) => {
                const date = e.currentTarget.value;
                setDraft((d) => ({ ...d, date }));
                setErrors([]);
              }}
            />
          </label>
          {records.some((r) => r.date === draft.date) ? (
            <p className="hint">
              Já existe um registro deste dia. Confirmar atualiza somente esta
              data na simulação.
            </p>
          ) : null}
          <nav className="unit-tabs" aria-label="Unidades de negócio">
            {units.map((u) => {
              const status = s.unitSummaries.find((item) => item.id === u.id)!;
              return (
                <button
                  type="button"
                  key={u.id}
                  aria-pressed={active === u.id}
                  className={active === u.id ? "selected" : ""}
                  onClick={() => {
                    setActive(u.id);
                    setErrors([]);
                  }}
                >
                  <b>{u.name}</b>
                  <small>
                    {status.complete
                      ? "✓ 4/4"
                      : `${status.count}/4 recebimentos`}
                  </small>
                </button>
              );
            })}
          </nav>
          <section
            className="panel payment-entry"
            aria-labelledby="active-unit-title"
          >
            <div className="section-title">
              <h2 id="active-unit-title">{units[index].name}</h2>
              <span className="muted">{index + 1} de 6</span>
            </div>
            {draft.values[active]?.trim() ? (
              <p className="hint">
                Referência anterior: {amount(cents(draft.values[active]))}. Sem
                divisão presumida entre recebimentos.
              </p>
            ) : null}
            <p className="entry-instruction" id="receipt-example">
              Digite o total recebido em cada forma. Ex.: 1.420,50.
            </p>
            <div className="payment-fields">
              {paymentMethods.map((m, i) => {
                const invalid = s.invalidFields.some(
                  (f) => f.unit === active && f.method === m.id,
                );
                return (
                  <label
                    className={`payment-field ${invalid ? "invalid" : ""}`}
                    key={m.id}
                  >
                    <span>{m.name}</span>
                    <span className="currency-input">
                      <span aria-hidden="true">R$</span>
                      <input
                        id={`unit-sales-${active}-${m.id}`}
                        aria-label={`${m.name} de ${units[index].name}`}
                        inputMode="decimal"
                        autoComplete="off"
                        enterKeyHint={i === 3 ? "done" : "next"}
                        placeholder="Digite o valor"
                        value={draft.receipts?.[active]?.[m.id] ?? ""}
                        aria-invalid={invalid}
                        aria-describedby={
                          invalid ? `payment-error-${m.id}` : "receipt-example"
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && i === 3) {
                            e.preventDefault();
                            e.stopPropagation();
                            document
                              .getElementById(
                                index < 5 ? "next-unit" : "review-values",
                              )
                              ?.focus();
                          }
                        }}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDraft((d) => ({
                            ...d,
                            receipts: {
                              ...d.receipts!,
                              [active]: {
                                ...d.receipts![active],
                                [m.id]: value,
                              },
                            },
                          }));
                          setErrors([]);
                        }}
                      />
                    </span>
                    {invalid ? (
                      <small id={`payment-error-${m.id}`}>
                        Use um valor válido, como 1.420,50.
                      </small>
                    ) : null}
                  </label>
                );
              })}
            </div>
            <button
              type="button"
              className="secondary no-movement"
              onClick={() => {
                setDraft((d) => ({
                  ...d,
                  receipts: {
                    ...d.receipts!,
                    [active]: {
                      debito: "0,00",
                      credito: "0,00",
                      dinheiro: "0,00",
                      pix: "0,00",
                    },
                  },
                }));
                setErrors([]);
              }}
            >
              Sem movimento nesta unidade
            </button>
            <div className="unit-calculation">
              <div>
                <span>Bruto {current.complete ? "" : "· parcial"}</span>
                <b>{amount(current.gross)}</b>
              </div>
              <div>
                <span>Taxas</span>
                <b>{amount(current.fees)}</b>
              </div>
              <div>
                <span>Líquido após taxas</span>
                <b>{amount(current.net)}</b>
              </div>
            </div>
            <p className="hint">
              Sem recebimento? Digite 0,00. Se não souber, deixe em branco.
            </p>
            {index < 5 ? (
              <button
                type="button"
                id="next-unit"
                className="primary"
                onClick={() => {
                  setActive(units[index + 1].id);
                  requestAnimationFrame(() =>
                    document
                      .getElementById(
                        `unit-sales-${units[index + 1].id}-debito`,
                      )
                      ?.focus(),
                  );
                }}
              >
                Próxima unidade · {units[index + 1].name}{" "}
                <Icon name="arrow" size={18} />
              </button>
            ) : null}
          </section>
          <details className="panel fee-settings">
            <summary>
              Taxas em uso ·{" "}
              {feeMethods.every((m) => !!draft.rates?.[m]?.trim())
                ? "conferir percentuais"
                : "definir percentuais"}
            </summary>
            <p>
              Percentuais comuns às seis unidades. Informe 0 se não houver taxa.
              Em branco significa taxa desconhecida.
            </p>
            <div className="fee-fields">
              {feeMethods.map((m) => (
                <label className="text-field" key={m}>
                  Taxa de {paymentMethods.find((p) => p.id === m)!.name}
                  <span className="rate-input">
                    <input
                      id={`fee-${m}`}
                      aria-label={`Taxa de ${paymentMethods.find((p) => p.id === m)!.name}`}
                      value={draft.rates?.[m] ?? ""}
                      inputMode="decimal"
                      placeholder="Ex.: 1,50"
                      aria-invalid={s.invalidRates.includes(m)}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDraft((d) => ({
                          ...d,
                          rates: { ...d.rates!, [m]: value },
                        }));
                        setErrors([]);
                      }}
                    />
                    <span aria-hidden="true">%</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="hint">
              Reutilizadas nos próximos preenchimentos desta aba após confirmar.
              Registros anteriores guardam as taxas que foram usadas.
            </p>
          </details>
          <Totals draft={draft} />
          <button className="primary" id="review-values" type="submit">
            Revisar valores <Icon name="arrow" size={18} />
          </button>
        </form>
      )}
      <p className="hint" role="status">
        {localSaved
          ? "Salvo nesta aba · recuperável ao recarregar · sem envio ao servidor"
          : "Armazenamento indisponível · rascunho somente em memória"}
      </p>
      <Link className="secondary unit-new" to="/simulacao">
        Ver registros nos indicadores da simulação
      </Link>
      <details className="panel">
        <summary>Histórico local · {records.length} dias</summary>
        {records.map((r) => (
          <button
            type="button"
            className="secondary unit-new"
            key={r.date}
            onClick={() => {
              setDraft(recordToDraft(r));
              selectUnitSalesRecord(r);
              setReview(false);
              setErrors([]);
            }}
          >
            {dateLabel(r.date)} · {amount(r.total)} ·{" "}
            {r.receipts
              ? `${r.completeCount ?? 0}/6 completas`
              : "Sem detalhamento por recebimento"}
          </button>
        ))}
      </details>
      <Link className="text-link unit-new" to="/caixa">
        Histórico do caixa e conferência ↗
      </Link>
    </div>
  );
}
