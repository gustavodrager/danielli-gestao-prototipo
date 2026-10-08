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

export default function ExpenseInput({ kind }: { kind: ExpenseKind }) {
  const { expenseDrafts, setExpenseDrafts, expenseRecords, setExpenseRecords } =
    useDemo();
  const draft = expenseDrafts[kind];
  const name = expenseKinds.find((k) => k.id === kind)!.name;
  const isStaff = kind.startsWith("staff-");
  const [errors, setErrors] = useState<ReturnType<typeof expenseErrors>>([]);
  const feedback = useRef<HTMLDivElement>(null);
  const details = useRef<HTMLDetailsElement>(null);
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
                <div>
                  <dt>Observação</dt>
                  <dd className="preserve-lines">{record.reference}</dd>
                </div>
              ) : null}
            </dl>
            <p className="hint">Salvo na simulação desta aba.</p>
          </div>
          <button
            type="button"
            className="primary"
            onClick={() => update({ confirmed: false })}
          >
            Editar lançamento
          </button>
          <button
            type="button"
            className="secondary unit-new"
            onClick={() =>
              setExpenseDrafts((current) => ({
                ...current,
                [kind]: emptyExpense(),
              }))
            }
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
                      onClick={() => {
                        if (e.field === "expense-month" && details.current)
                          details.current.open = true;
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
          <label className="payment-field amount-field">
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
                aria-invalid={errors.some((e) => e.field === "expense-amount")}
                onChange={(e) => update({ amount: e.target.value })}
              />
            </span>
          </label>
          <p className="hint">
            Campo vazio significa não informado. Zero deve ser digitado
            explicitamente.
          </p>
          <details
            ref={details}
            className="panel expense-details"
            open={kind === "staff-fixed" ? true : undefined}
          >
            <summary>
              {kind === "staff-fixed"
                ? "Referência do mês e detalhes"
                : "Adicionar detalhes / ajustar mês"}
            </summary>
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
            <label className="text-field">
              {isStaff ? "Nome / identificação" : "Categoria"}{" "}
              <small>Opcional</small>
              <input
                value={draft.category}
                placeholder={
                  isStaff
                    ? "Pessoa, grupo ou referência"
                    : "Ex.: aluguel, contabilidade ou comissão"
                }
                onChange={(e) => update({ category: e.target.value })}
              />
            </label>
            <label className="text-field">
              Observação <small>Opcional</small>
              <textarea
                rows={2}
                value={draft.reference}
                placeholder={
                  isStaff
                    ? "Descreva o que está incluído no total, se souber"
                    : "Referência do registro ou observação"
                }
                onChange={(e) => update({ reference: e.target.value })}
              />
            </label>
          </details>
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
          {name} · {history.length} lançamentos
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
                document
                  .getElementById("expense-heading")
                  ?.scrollIntoView({ block: "start", behavior: "smooth" });
              }}
            >
              <span>
                <b>{r.category || name}</b>
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
