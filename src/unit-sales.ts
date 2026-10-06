import { cents, units } from "./data.ts";

export type UnitId = (typeof units)[number]["id"];
export interface UnitSalesDraft {
  date: string;
  values: Record<UnitId, string>;
}
export interface UnitSalesRecord {
  date: string;
  values: Record<UnitId, number | null>;
  total: number;
  count: number;
}
export function emptyUnitSales(): UnitSalesDraft {
  return {
    date: new Date().toLocaleDateString("sv-SE", {
      timeZone: "America/Sao_Paulo",
    }),
    values: Object.fromEntries(units.map((u) => [u.id, ""])) as Record<
      UnitId,
      string
    >,
  };
}
export function unitSalesSummary(draft: UnitSalesDraft) {
  const values = Object.fromEntries(
    units.map((u) => {
      const raw = draft.values[u.id].trim();
      return [
        u.id,
        raw && raw.replace(/^R\$\s*/, "").trim() ? cents(raw) : null,
      ];
    }),
  ) as Record<UnitId, number | null>;
  const invalid = units.filter(
    (u) => draft.values[u.id].trim() && values[u.id] === null,
  );
  const count = Object.values(values).filter((v) => v !== null).length;
  return {
    values,
    count,
    invalid,
    total:
      invalid.length || !count
        ? null
        : Object.values(values).reduce<number>(
            (total, v) => total + (v ?? 0),
            0,
          ),
  };
}
export function unitSalesErrors(draft: UnitSalesDraft) {
  const errors: { field: string; message: string }[] = [];
  const parsed = new Date(`${draft.date}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== draft.date
  )
    errors.push({
      field: "unit-sales-date",
      message: "Informe uma data válida.",
    });
  const summary = unitSalesSummary(draft);
  for (const u of summary.invalid)
    errors.push({
      field: `unit-sales-${u.id}`,
      message: `${u.name}: use um valor de zero ou maior, com até duas casas decimais.`,
    });
  if (!summary.count && !summary.invalid.length)
    errors.push({
      field: "unit-sales-balcao",
      message:
        "Informe o valor de pelo menos uma unidade. Use 0,00 quando não houver venda.",
    });
  return errors;
}
