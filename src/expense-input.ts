import { purchaseAmount } from "./purchase-input.ts";
import { todayInSaoPaulo } from "./months.ts";

export const expenseKinds = [
  { id: "fixed", name: "Despesas fixas", area: "fixas" },
  { id: "variable", name: "Despesas variáveis", area: "variaveis" },
  { id: "staff-fixed", name: "Equipe fixa", area: "pessoal" },
  { id: "staff-freela", name: "Freelas", area: "pessoal" },
] as const;
export type ExpenseKind = (typeof expenseKinds)[number]["id"];
export interface ExpenseDraft {
  id?: string;
  confirmed?: boolean;
  date: string;
  month: string;
  amount: string;
  category: string;
  reference: string;
}
export interface ExpenseRecord {
  id: string;
  kind: ExpenseKind;
  date: string;
  month: string;
  amount: number;
  category: string;
  reference: string;
}
export function emptyExpense(): ExpenseDraft {
  const date = todayInSaoPaulo();
  return {
    date,
    month: date.slice(0, 7),
    amount: "",
    category: "",
    reference: "",
  };
}
export function emptyExpenseDrafts(): Record<ExpenseKind, ExpenseDraft> {
  return Object.fromEntries(
    expenseKinds.map(({ id }) => [id, emptyExpense()]),
  ) as Record<ExpenseKind, ExpenseDraft>;
}
export function expenseErrors(draft: ExpenseDraft) {
  const errors: { field: string; message: string }[] = [];
  const date = new Date(`${draft.date}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== draft.date
  )
    errors.push({
      field: "expense-date",
      message: "Informe uma data válida para o registro.",
    });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.month))
    errors.push({
      field: "expense-month",
      message: "Informe o mês de referência.",
    });
  if (purchaseAmount(draft.amount) === null)
    errors.push({
      field: "expense-amount",
      message:
        "Informe um valor de zero ou maior, com até duas casas decimais.",
    });
  return errors;
}
export function makeExpenseRecord(
  draft: ExpenseDraft,
  kind: ExpenseKind,
  newId: string,
): ExpenseRecord {
  if (expenseErrors(draft).length) throw new Error("Lançamento inválido");
  return {
    id: draft.id ?? newId,
    kind,
    date: draft.date,
    month: draft.month,
    amount: purchaseAmount(draft.amount)!,
    category: draft.category.trim(),
    reference: draft.reference.trim(),
  };
}
export function expenseToDraft(record: ExpenseRecord): ExpenseDraft {
  return {
    ...record,
    amount: (record.amount / 100).toFixed(2),
    confirmed: false,
  };
}
export function upsertExpense(records: ExpenseRecord[], record: ExpenseRecord) {
  return [...records.filter((r) => r.id !== record.id), record].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}
export function expenseTotals(records: ExpenseRecord[], month: string) {
  const matching = records.filter((r) => r.month === month);
  const total = (kind: ExpenseKind) => {
    const selected = matching.filter((r) => r.kind === kind);
    return selected.length
      ? selected.reduce((sum, r) => sum + r.amount, 0)
      : null;
  };
  const fixed = total("fixed"),
    variable = total("variable"),
    staffFixed = total("staff-fixed"),
    staffFreela = total("staff-freela");
  return {
    fixed,
    variable,
    staffFixed,
    staffFreela,
    staff:
      staffFixed === null && staffFreela === null
        ? null
        : (staffFixed ?? 0) + (staffFreela ?? 0),
  };
}
