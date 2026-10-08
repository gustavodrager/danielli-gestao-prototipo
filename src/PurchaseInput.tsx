import { useSearchParams } from "react-router-dom";
import ExpenseInput from "./ExpenseInput";
import SpendingSummary from "./SpendingSummary";
import { todayInSaoPaulo } from "./months";
import { useEffect, useRef, useState } from "react";
import { useDemo } from "./demo-context";
import { dateLabel, money } from "./data";
import {
  emptyPurchase,
  purchaseAmount,
  purchaseErrors,
} from "./purchase-input";
import { Icon } from "./ui";
import { Link } from "./navigation";

function PurchaseForm() {
  const {
    purchaseDraft: draft,
    setPurchaseDraft: setDraft,
    purchaseRecord: record,
    setPurchaseRecord: setRecord,
    purchaseRecords: records,
  } = useDemo();
  const [errors, setErrors] = useState<ReturnType<typeof purchaseErrors>>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLElement>(null);
  const amount = purchaseAmount(draft.amount);
  const invalid = !!draft.amount.trim() && amount === null;
  useEffect(() => {
    if (errors.length) errorRef.current?.focus();
  }, [errors]);
  useEffect(() => {
    if (record) confirmationRef.current?.focus();
  }, [record]);
  return (
    <section aria-label="Entrada de compras">
      <h2>Compras / CMV</h2>
      {record ? (
        <>
          <section
            className="panel unit-confirmation"
            ref={confirmationRef}
            tabIndex={-1}
            aria-labelledby="purchase-confirmed-title"
          >
            <div className="section-title">
              <h2 id="purchase-confirmed-title">Compras confirmadas</h2>
              <Icon name="check" />
            </div>
            <dl className="fact-list">
              <div>
                <dt>Data</dt>
                <dd>{dateLabel(record.date)}</dd>
              </div>
              <div>
                <dt>Total de compras</dt>
                <dd>{money(record.amount / 100)}</dd>
              </div>
              {record.reference ? (
                <div>
                  <dt>Referência / observação</dt>
                  <dd className="preserve-lines">{record.reference}</dd>
                </div>
              ) : null}
            </dl>
            <p className="hint">
              Simulação local confirmada. O histórico real permanece separado.
            </p>
          </section>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setRecord(null);
              setErrors([]);
            }}
          >
            Editar compra
          </button>
          <button
            type="button"
            className="secondary unit-new"
            onClick={() => {
              setDraft(emptyPurchase());
              setRecord(null);
              setErrors([]);
            }}
          >
            Novo preenchimento
          </button>
        </>
      ) : (
        <>
          <p>Informe o total de compras do dia, conforme seus registros.</p>
          {errors.length ? (
            <div
              className="form-errors"
              role="alert"
              tabIndex={-1}
              ref={errorRef}
            >
              <b>Revise os campos</b>
              <ul>
                {errors.map((error) => (
                  <li key={error.field}>
                    <a href={`#${error.field}`}>{error.message}</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {records.some((r) => r.date === draft.date) ? (
            <p className="hint">
              Já existe um total deste dia na simulação. Confirmar atualiza esse
              registro.
            </p>
          ) : null}
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const next = purchaseErrors(draft);
              setErrors(next);
              if (next.length || amount === null) return;
              setRecord({
                date: draft.date,
                amount,
                reference: draft.reference.trim(),
              });
            }}
          >
            <label className="text-field">
              Data das compras
              <input
                id="purchase-date"
                enterKeyHint="next"
                type="date"
                required
                value={draft.date}
                aria-invalid={errors.some(
                  (error) => error.field === "purchase-date",
                )}
                onInput={(event) => {
                  const date = event.currentTarget.value;
                  setDraft((current) => ({ ...current, date }));
                  setErrors([]);
                }}
              />
            </label>
            <label
              className={`payment-field amount-field ${invalid ? "invalid" : ""}`}
            >
              <span>Total de compras</span>
              <span className="currency-input">
                <span aria-hidden="true">R$</span>
                <input
                  id="purchase-amount"
                  enterKeyHint="next"
                  aria-label="Total de compras"
                  required
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.amount}
                  placeholder="Ex.: 1.420,00"
                  aria-invalid={invalid}
                  aria-describedby={
                    invalid ? "purchase-value-error" : undefined
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => ({ ...current, amount: value }));
                    setErrors([]);
                  }}
                />
              </span>
              {invalid ? (
                <small id="purchase-value-error">
                  Use um valor de zero ou maior, como 1.420,00.
                </small>
              ) : null}
            </label>
            <p className="hint">
              Sem compras? Digite 0,00. Campo vazio significa valor não
              informado.
            </p>
            <label className="text-field">
              Referência / observação <small>Opcional</small>
              <textarea
                rows={2}
                value={draft.reference}
                placeholder="Livro, planilha ou observação da compra"
                onChange={(event) => {
                  const reference = event.target.value;
                  setDraft((current) => ({ ...current, reference }));
                }}
              />
            </label>
            <button className="primary" type="submit">
              Confirmar compras <Icon name="check" size={18} />
            </button>
          </form>
        </>
      )}
      <p className="hint purchase-method">
        Compras são uma aproximação do CMV. O CMV real depende dos estoques
        inicial e final. Valores gerais da Danielli, sem rateio por unidade.
      </p>
      <details className="panel">
        <summary>Histórico local · {records.length} dias</summary>
        {records.map((r) => (
          <button
            type="button"
            className="secondary unit-new"
            key={r.date}
            onClick={() => {
              setRecord(null);
              setErrors([]);
              setDraft({
                date: r.date,
                amount: (r.amount / 100).toFixed(2),
                reference: r.reference,
              });
            }}
          >
            Editar {dateLabel(r.date)}
          </button>
        ))}
      </details>
    </section>
  );
}

const spendingAreas = [
  { id: "cmv", name: "Compras / CMV", description: "Alimentos e insumos" },
  { id: "pessoal", name: "Pessoal", description: "Equipe fixa e freelas" },
  { id: "fixas", name: "Despesas fixas", description: "Gastos fixos gerais" },
  {
    id: "variaveis",
    name: "Despesas variáveis",
    description: "Outros gastos variáveis",
  },
] as const;
export default function PurchaseInput() {
  const [params, setParams] = useSearchParams();
  const area =
    spendingAreas.find((a) => a.id === params.get("area"))?.id ?? "cmv";
  const freela = params.get("equipe") === "freela";
  const { localSaved } = useDemo();
  const requestedMonth = params.get("resumo");
  const month =
    requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)
      ? requestedMonth
      : todayInSaoPaulo().slice(0, 7);
  const choose = (field: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set(field, value);
      return next;
    });
  return (
    <div className="unit-entry purchase-entry">
      <span className="eyebrow">ENTRADAS · DANIELLI</span>
      <h1>Compras e despesas</h1>
      <p>Escolha o que deseja informar.</p>
      <div
        className="spending-areas"
        role="group"
        aria-label="Tipo de lançamento"
      >
        {spendingAreas.map((a) => (
          <button
            type="button"
            key={a.id}
            className={area === a.id ? "selected" : ""}
            aria-pressed={area === a.id}
            onClick={() => choose("area", a.id)}
          >
            <b>{a.name}</b>
            <small>{a.description}</small>
          </button>
        ))}
      </div>
      {area === "cmv" ? (
        <PurchaseForm />
      ) : (
        <>
          {area === "pessoal" ? (
            <div
              className="staff-switch"
              role="group"
              aria-label="Tipo de equipe"
            >
              <button
                type="button"
                className={!freela ? "selected" : ""}
                aria-pressed={!freela}
                onClick={() => choose("equipe", "fixa")}
              >
                Equipe fixa
              </button>
              <button
                type="button"
                className={freela ? "selected" : ""}
                aria-pressed={freela}
                onClick={() => choose("equipe", "freela")}
              >
                Freelas
              </button>
            </div>
          ) : null}
          <ExpenseInput
            key={
              area === "pessoal"
                ? freela
                  ? "staff-freela"
                  : "staff-fixed"
                : area
            }
            kind={
              area === "pessoal"
                ? freela
                  ? "staff-freela"
                  : "staff-fixed"
                : area === "fixas"
                  ? "fixed"
                  : "variable"
            }
          />
        </>
      )}
      <label className="text-field spending-period">
        Mês do resumo
        <input
          type="month"
          value={month}
          onInput={(e) => choose("resumo", e.currentTarget.value)}
        />
      </label>
      <SpendingSummary month={month} />
      <Link className="secondary unit-new" to="/simulacao">
        Ver todos os registros da simulação
      </Link>
      <p className="unit-session-note">
        {localSaved
          ? "Simulação salva nesta aba · recuperável ao recarregar. Apague ao terminar em um dispositivo compartilhado."
          : "Armazenamento indisponível · valores somente em memória."}
      </p>
    </div>
  );
}
