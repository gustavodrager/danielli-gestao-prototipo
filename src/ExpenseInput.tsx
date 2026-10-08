import { useEffect, useRef, useState } from "react";
import { useDemo } from "./demo-context";
import { dateLabel, money } from "./data";
import {
  emptyExpense,
  expenseErrors,
  expenseKinds,
  expenseToDraft,
  makeExpenseRecord,
  upsertExpense,
  type ExpenseKind,
} from "./expense-input";
import { Icon } from "./ui";
import { purchaseAmount } from "./purchase-input";
import { focusSpendingForm } from "./spending-navigation";

export default function ExpenseInput({
  kind,
  onSaved,
}: {
  kind: ExpenseKind;
  onSaved: (month: string) => void;
}) {
  const { expenseDrafts, setExpenseDrafts, expenseRecords, setExpenseRecords } =
    useDemo();
  const draft = expenseDrafts[kind];
  const name = expenseKinds.find((k) => k.id === kind)!.name;
  const isStaff = kind.startsWith("staff-");
  const [errors, setErrors] = useState<ReturnType<typeof expenseErrors>>([]);
  const invalid =
    !!draft.amount.trim() && purchaseAmount(draft.amount) === null;
  const amountError =
    invalid || errors.some((e) => e.field === "expense-amount");
  const feedback = useRef<HTMLDivElement>(null);
  const update = (patch: Partial<typeof draft>) => {
    setExpenseDrafts((current) => ({
      ...current,
      [kind]: { ...current[kind], ...patch },
    }));
    setErrors([]);
  };
  useEffect(() => {
    if (errors.length || draft.confirmed) feedback.current?.focus();
  }, [errors, draft.confirmed]);
  const record = draft.confirmed
    ? expenseRecords.find((r) => r.id === draft.id)
    : undefined;
  const history = expenseRecords.filter((r) => r.kind === kind);
  return (
    <section aria-labelledby="expense-heading">
      <h2 id="expense-heading">{name}</h2>
      <p>
        {kind === "staff-fixed"
          ? "Informe o total da equipe no mês. Não é necessário cadastrar cada funcionário."
          : kind === "staff-freela"
            ? "Informe o valor da equipe extra. Você pode registrar um total ou detalhar cada pagamento."
            : "Informe o valor conforme seus registros. Cada confirmação cria um lançamento; editar corrige o lançamento escolhido."}
      </p>
      {record ? (
        <>
          <div
            className="panel unit-confirmation"
            ref={feedback}
            tabIndex={-1}
            role="status"
          >
            <div className="section-title">
              <h3>Lançamento confirmado</h3>
              <Icon name="check" />
            </div>
            <dl className="fact-list">
              <div>
                <dt>{name}</dt>
                <dd>{money(record.amount / 100)}</dd>
              </div>
              <div>
                <dt>Mês de referência</dt>
                <dd>{record.month.split("-").reverse().join("/")}</dd>
              </div>
              <div>
                <dt>Data do registro</dt>
                <dd>{dateLabel(record.date)}</dd>
              </div>
              <div>
                <dt>{isStaff ? "Identificação" : "Categoria"}</dt>
                <dd>
                  {record.category ||
                    (isStaff
                      ? "Total sem identificação individual"
                      : "A classificar")}
                </dd>
              </div>
              {record.reference ? (
                <div className="full-description">
                  <dt>Descrição do valor informado</dt>
                  <dd className="preserve-lines">{record.reference}</dd>
                </div>
              ) : null}
            </dl>
            <p className="hint">Salvo na simulação desta aba.</p>
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => {
              update({ confirmed: false });
              focusSpendingForm();
            }}
          >
            Editar lançamento
          </button>
          <button
            type="button"
            className="secondary unit-new"
            onClick={() => {
              setExpenseDrafts((current) => ({
                ...current,
                [kind]: emptyExpense(),
              }));
              focusSpendingForm();
            }}
          >
            Novo lançamento
          </button>
        </>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const next = expenseErrors(draft);
            setErrors(next);
            if (next.length) return;
            const saved = makeExpenseRecord(draft, kind, crypto.randomUUID());
            setExpenseRecords((current) => upsertExpense(current, saved));
            update({ id: saved.id, confirmed: true });
            onSaved(saved.month);
          }}
        >
          {errors.length ? (
            <div
              className="form-errors"
              role="alert"
              tabIndex={-1}
              ref={feedback}
            >
              <b>Revise os campos</b>
              <ul>
                {errors.map((e) => (
                  <li key={e.field}>
                    <a
                      href={`#${e.field}`}
                      onClick={(event) => {
                        event.preventDefault();
                        document.getElementById(e.field)?.focus();
                      }}
                    >
                      {e.message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {draft.id ? (
            <p className="hint">
              Editando um lançamento existente. Confirmar substitui apenas este
              registro.
            </p>
          ) : null}
          {!draft.id && history.some((r) => r.month === draft.month) ? (
            <p className="hint">
              Já há valores neste mês para {name.toLowerCase()}. Novo lançamento
              soma ao total. Para corrigir um valor, use Editar no histórico
              abaixo.
            </p>
          ) : null}
          <label className="text-field">
            Data do registro
            <input
              id="expense-date"
              type="date"
              enterKeyHint="next"
              required
              value={draft.date}
              aria-invalid={errors.some((e) => e.field === "expense-date")}
              onInput={(e) => {
                const date = e.currentTarget.value;
                update({
                  date,
                  month:
                    draft.month === draft.date.slice(0, 7)
                      ? date.slice(0, 7)
                      : draft.month,
                });
              }}
            />
          </label>
          <label className="text-field">
            Mês de referência
            <input
              id="expense-month"
              type="month"
              required
              value={draft.month}
              aria-invalid={errors.some((e) => e.field === "expense-month")}
              onInput={(e) => update({ month: e.currentTarget.value })}
            />
          </label>
          <label
            className={`payment-field amount-field ${amountError ? "invalid" : ""}`}
          >
            <span>
              {kind === "staff-fixed"
                ? "Total da equipe fixa"
                : kind === "staff-freela"
                  ? "Valor da equipe extra"
                  : "Valor da despesa"}
            </span>
            <span className="currency-input">
              <span aria-hidden="true">R$</span>
              <input
                id="expense-amount"
                enterKeyHint="next"
                aria-label={
                  kind === "staff-fixed"
                    ? "Total da equipe fixa"
                    : kind === "staff-freela"
                      ? "Valor da equipe extra"
                      : "Valor da despesa"
                }
                required
                inputMode="decimal"
                autoComplete="off"
                placeholder="Ex.: 1.250,00"
                value={draft.amount}
                aria-invalid={amountError}
                aria-describedby={
                  amountError ? "expense-value-error" : "expense-amount-help"
                }
                onChange={(e) => update({ amount: e.target.value })}
              />
            </span>
            {amountError ? (
              <small id="expense-value-error">
                Informe um valor de zero ou maior, com até duas casas decimais.
                Ex.: 1.250,50.
              </small>
            ) : null}
          </label>
          <p className="hint" id="expense-amount-help">
            Campo vazio significa não informado. Zero deve ser digitado
            explicitamente.
          </p>
          <label className="text-field">
            Descrição do valor informado <small>Opcional</small>
            <textarea
              id="expense-description"
              rows={2}
              value={draft.reference}
              aria-describedby="expense-description-help"
              placeholder={
                kind === "staff-fixed"
                  ? "Ex.: salários da equipe fixa no mês"
                  : kind === "staff-freela"
                    ? "Ex.: equipe extra do almoço de sábado"
                    : kind === "fixed"
                      ? "Ex.: aluguel do restaurante"
                      : "Ex.: comissão de delivery do período"
              }
              onChange={(e) => update({ reference: e.target.value })}
            />
          </label>
          <p className="hint" id="expense-description-help">
            Descreva o que este valor reúne. Pode ser um gasto, um grupo de
            despesas ou um pagamento da equipe.
          </p>
          {isStaff ? (
            <p className="hint">
              Informe o valor conhecido. Encargos e benefícios não são
              acrescentados automaticamente. Evite registrar o mesmo total
              também em despesas.
            </p>
          ) : kind === "variable" ? (
            <p className="hint">
              Compras e pessoal têm opções próprias nesta página. Taxas
              calculadas no Caixa ficam separadas; não são importadas
              automaticamente.
            </p>
          ) : null}
          <button className="primary" type="submit">
            {draft.id ? "Confirmar alteração" : "Confirmar lançamento"}{" "}
            <Icon name="check" size={18} />
          </button>
        </form>
      )}
      <details className="panel expense-history">
        <summary>
          {name} · {history.length}{" "}
          {history.length === 1 ? "lançamento" : "lançamentos"}
        </summary>
        {!history.length ? (
          <p>Nenhum lançamento informado.</p>
        ) : (
          history.map((r) => (
            <button
              key={r.id}
              type="button"
              className="expense-history-row"
              onClick={() => {
                setExpenseDrafts((current) => ({
                  ...current,
                  [kind]: expenseToDraft(r),
                }));
                setErrors([]);
                focusSpendingForm();
              }}
            >
              <span>
                <b>{r.category || name}</b>
                {r.reference ? (
                  <small className="preserve-lines">{r.reference}</small>
                ) : null}
                <small>
                  {dateLabel(r.date)} · Ref.{" "}
                  {r.month.split("-").reverse().join("/")}
                </small>
              </span>
              <span>
                <b>{money(r.amount / 100)}</b>
                <small>Editar ↗</small>
              </span>
            </button>
          ))
        )}
      </details>
    </section>
  );
}
