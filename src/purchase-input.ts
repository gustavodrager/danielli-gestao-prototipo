import { cents } from "./data.ts";

export interface PurchaseDraft {
  date: string;
  amount: string;
  reference: string;
}
export interface PurchaseRecord {
  date: string;
  amount: number;
  reference: string;
}
export function emptyPurchase(): PurchaseDraft {
  return {
    date: new Date().toLocaleDateString("sv-SE", {
      timeZone: "America/Sao_Paulo",
    }),
    amount: "",
    reference: "",
  };
}
export function purchaseAmount(value: string) {
  const raw = value.trim();
  return raw && raw.replace(/^R\$\s*/, "").trim() ? cents(raw) : null;
}
export function purchaseErrors(draft: PurchaseDraft) {
  const errors: { field: string; message: string }[] = [];
  const parsed = new Date(`${draft.date}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== draft.date
  )
    errors.push({
      field: "purchase-date",
      message: "Informe uma data válida.",
    });
  if (purchaseAmount(draft.amount) === null)
    errors.push({
      field: "purchase-amount",
      message:
        "Informe o total de compras com até duas casas decimais. Use 0,00 quando não houver compra.",
    });
  return errors;
}
