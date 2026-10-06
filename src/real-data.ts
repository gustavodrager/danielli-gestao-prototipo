import records from "./real-cash.json" with { type: "json" };
import { type RealUnit } from "./unit-origins.ts";
export { confirmedUnitOrigins, type RealUnit } from "./unit-origins.ts";

export const realCash = records;
export type RealCash = (typeof realCash)[number];
export type RealField = keyof RealCash["values"];
export function realUnitTotal(unit: RealUnit) {
  const available = realCash.filter((r) => r.unitValues[unit] !== null);
  return {
    cents: available.reduce((s, r) => s + (r.unitValues[unit] ?? 0), 0),
    count: available.length,
  };
}
export function realUnitStatus(record: RealCash, unit: RealUnit) {
  if (record.unitValues[unit] !== null) return "Valor transcrito";
  return record.unitPending[unit] === "desfoque"
    ? "Leitura pendente"
    : "Sem valor anotado";
}
export const receiptFields = [
  ["dinheiro", "Dinheiro"],
  ["pix", "Pix"],
  ["debito", "Débito"],
  ["credito", "Crédito"],
  ["voucher", "Voucher"],
  ["ifood", "iFood"],
] as const;
export function realTotal(field: RealField) {
  const available = realCash.filter((r) => r.values[field] !== null);
  return {
    cents: available.reduce((s, r) => s + (r.values[field] ?? 0), 0),
    count: available.length,
  };
}
export function receiptTotal(record: RealCash) {
  const values = receiptFields.map(([id]) => record.values[id]);
  return values.some((v) => v === null)
    ? null
    : values.reduce<number>((s, v) => s + (v ?? 0), 0);
}
// Preserva os totais escritos. Inconsistências ficam visíveis, sem corrigir o livro.
export function reconciliation(record: RealCash) {
  const receipts = receiptTotal(record);
  const { saidas, vendas, registrado } = record.values;
  return {
    receipts,
    compositionGap:
      receipts === null || saidas === null || vendas === null
        ? null
        : receipts + saidas - vendas,
    difference:
      vendas === null || registrado === null ? null : vendas - registrado,
  };
}
