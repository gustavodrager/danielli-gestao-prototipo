import { useEffect, useRef, useState } from "react";
import { useDemo } from "./demo-context";
import { money, units, dateLabel } from "./data";
import {
  emptyUnitSales,
  unitSalesErrors,
  unitSalesSummary,
} from "./unit-sales";
import { Icon } from "./ui";
import { Link } from "react-router-dom";

export default function UnitSales() {
  const {
    unitSalesDraft: draft,
    setUnitSalesDraft: setDraft,
    unitSalesRecord: record,
    setUnitSalesRecord: setRecord,
    unitSalesRecords: records,
    localSaved,
  } = useDemo();
  const [errors, setErrors] = useState<ReturnType<typeof unitSalesErrors>>([]);
  const errorRef = useRef<HTMLDivElement>(null);
  const confirmedRef = useRef<HTMLElement>(null);
  const summary = unitSalesSummary(draft);
  useEffect(() => {
    if (errors.length) errorRef.current?.focus();
  }, [errors]);
  useEffect(() => {
    if (record) confirmedRef.current?.focus();
  }, [record]);
  return (
    <div className="unit-entry">
      <span className="eyebrow">CAIXA · VENDAS DO DIA</span>
      <h1>Vendas por unidade</h1>
      {record ? (
        <>
          <section
            className="panel unit-confirmation"
            ref={confirmedRef}
            tabIndex={-1}
            aria-labelledby="unit-confirmed-title"
          >
            <div className="section-title">
              <h2 id="unit-confirmed-title">Valores confirmados</h2>
              <Icon name="check" />
            </div>
            <p>
              {dateLabel(record.date)} · {record.count} de 6 unidades informadas
            </p>
            <dl className="fact-list">
              {units.map((u) => (
                <div key={u.id}>
                  <dt>{u.name}</dt>
                  <dd>
                    {record.values[u.id] === null
                      ? "Não informado"
                      : money(record.values[u.id]! / 100)}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="total-strip">
              <span>
                {record.count < units.length
                  ? "Total parcial informado"
                  : "Total informado"}
              </span>
              <strong>{money(record.total / 100)}</strong>
            </div>
            <p className="hint">
              Simulação local confirmada. O histórico real permanece separado.
            </p>
          </section>
          <button
            className="primary"
            type="button"
            onClick={() => {
              setRecord(null);
              setErrors([]);
            }}
          >
            Editar valores
          </button>
          <button
            className="secondary unit-new"
            type="button"
            onClick={() => {
              setDraft(emptyUnitSales());
              setRecord(null);
              setErrors([]);
            }}
          >
            Novo preenchimento
          </button>
        </>
      ) : (
        <>
          <p>Informe o total vendido em cada unidade.</p>
          {errors.length ? (
            <div
              ref={errorRef}
              className="form-errors"
              role="alert"
              tabIndex={-1}
            >
              <b>Revise os campos</b>
              <ul>
                {errors.map((e) => (
                  <li key={e.field}>
                    <a href={`#${e.field}`}>{e.message}</a>
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
            onSubmit={(e) => {
              e.preventDefault();
              const nextErrors = unitSalesErrors(draft);
              setErrors(nextErrors);
              if (nextErrors.length || summary.total === null) return;
              setRecord({
                date: draft.date,
                values: { ...summary.values },
                total: summary.total,
                count: summary.count,
              });
            }}
          >
            <label className="text-field">
              Data das vendas
              <input
                id="unit-sales-date"
                type="date"
                required
                value={draft.date}
                aria-invalid={errors.some((e) => e.field === "unit-sales-date")}
                onChange={(e) => {
                  setDraft((current) => ({ ...current, date: e.target.value }));
                  setErrors([]);
                }}
              />
            </label>
            <div className="unit-entry-fields">
              {units.map((u, index) => {
                const invalid = summary.invalid.some(
                  (item) => item.id === u.id,
                );
                const blank = !draft.values[u.id].trim();
                return (
                  <label
                    key={u.id}
                    className={`amount-field ${invalid ? "invalid" : ""}`}
                  >
                    <span className="unit-entry-name">
                      <b>{u.name}</b>
                      {blank ? <small>Não informado</small> : null}
                    </span>
                    <span className="currency-input">
                      <span aria-hidden="true">R$</span>
                      <input
                        id={`unit-sales-${u.id}`}
                        aria-label={u.name}
                        value={draft.values[u.id]}
                        inputMode="decimal"
                        enterKeyHint={
                          index === units.length - 1 ? "done" : "next"
                        }
                        autoComplete="off"
                        placeholder="—"
                        aria-invalid={invalid}
                        aria-describedby={
                          invalid ? `unit-error-${u.id}` : undefined
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          setDraft((current) => ({
                            ...current,
                            values: { ...current.values, [u.id]: value },
                          }));
                          setErrors([]);
                        }}
                      />
                    </span>
                    {invalid ? (
                      <small id={`unit-error-${u.id}`}>
                        Use um valor de zero ou maior, como 1.420,00.
                      </small>
                    ) : null}
                  </label>
                );
              })}
            </div>
            <div className="total-strip" aria-live="polite" aria-atomic="true">
              <span>
                {summary.count && summary.count < units.length
                  ? "Total parcial informado"
                  : "Total informado"}
                <small>{summary.count} de 6 unidades informadas</small>
              </span>
              <strong>
                {summary.invalid.length
                  ? "Revise os valores"
                  : summary.total === null
                    ? "—"
                    : money(summary.total / 100)}
              </strong>
            </div>
            <p className="hint">
              Sem venda? Digite 0,00. Se não souber o valor, deixe em branco.
            </p>
            <button className="primary" type="submit" id="confirm-values">
              Confirmar valores <Icon name="check" size={18} />
            </button>
          </form>
        </>
      )}
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
                values: Object.fromEntries(
                  Object.entries(r.values).map(([id, v]) => [
                    id,
                    v === null ? "" : (v / 100).toFixed(2),
                  ]),
                ) as typeof draft.values,
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
