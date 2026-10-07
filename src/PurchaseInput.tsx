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

export default function PurchaseInput() {
  const {
    purchaseDraft: draft,
    setPurchaseDraft: setDraft,
    purchaseRecord: record,
    setPurchaseRecord: setRecord,
    purchaseRecords: records,
    localSaved,
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
    <div className="unit-entry purchase-entry">
      <span className="eyebrow">ENTRADA DE COMPRAS · DANIELLI</span>
      <h1>Compras / CMV</h1>
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
            <label className={`amount-field ${invalid ? "invalid" : ""}`}>
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
                  placeholder="—"
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
      <p className="unit-session-note">
        {localSaved
          ? "Simulação salva nesta aba · recuperável ao recarregar. Apague ao terminar em um dispositivo compartilhado."
          : "Armazenamento indisponível · valores somente em memória."}
      </p>
    </div>
  );
}
