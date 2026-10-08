import { cents, units } from "./data.ts";
import { todayInSaoPaulo } from "./months.ts";
export type UnitId = (typeof units)[number]["id"];
export const paymentMethods = [
  { id: "debito", name: "Cartão débito" },
  { id: "credito", name: "Cartão crédito" },
  { id: "dinheiro", name: "Dinheiro" },
  { id: "pix", name: "Pix" },
] as const;
export type PaymentId = (typeof paymentMethods)[number]["id"];
export const feeMethods = ["debito", "credito", "pix"] as const;
export type FeeId = (typeof feeMethods)[number];
export type FeeDraft = Record<FeeId, string>;
export type UnitPayments<T> = Record<UnitId, Record<PaymentId, T>>;
export type LegacySalesTotals = {
  values: Record<UnitId, number | null>;
  total: number;
  count: number;
};
export interface UnitSalesDraft {
  date: string;
  values: Record<UnitId, string>; // Referência dos registros antigos, nunca distribuída.
  receipts?: UnitPayments<string>;
  rates?: FeeDraft;
  legacyTotals?: LegacySalesTotals;
}
export interface UnitSalesRecord {
  date: string;
  values: Record<UnitId, number | null>;
  total: number;
  count: number;
  receipts?: UnitPayments<number | null>;
  rates?: Record<FeeId, number | null>; // Centésimos de ponto percentual.
  completeCount?: number;
  feesTotal?: number | null;
  netTotal?: number | null;
  partialFees?: number | null;
  partialNet?: number | null;
  netCount?: number;
  legacyTotals?: LegacySalesTotals;
}
export const emptyRates = (): FeeDraft => ({
  debito: "",
  credito: "",
  pix: "",
});
export const defaultRates = (): FeeDraft => ({
  debito: "3,00",
  credito: "4,00",
  pix: "1,00",
});
export function blankPayments(): UnitPayments<string> {
  return Object.fromEntries(
    units.map((u) => [
      u.id,
      Object.fromEntries(paymentMethods.map((m) => [m.id, ""])),
    ]),
  ) as UnitPayments<string>;
}
export function emptyUnitSales(rates = emptyRates()): UnitSalesDraft {
  return {
    date: todayInSaoPaulo(),
    values: Object.fromEntries(
      units.map((u) => [u.id, ""]),
    ) as UnitSalesDraft["values"],
    receipts: blankPayments(),
    rates: { ...rates },
  };
}
export function upgradeUnitSalesDraft(draft: UnitSalesDraft): UnitSalesDraft {
  return {
    ...draft,
    receipts: draft.receipts ?? blankPayments(),
    rates: draft.rates ?? emptyRates(),
  };
}
export function ratePoints(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+(?:[,.]\d{1,2})?$/.test(text)) return null;
  const points = Math.round(Number(text.replace(",", ".")) * 100);
  return Number.isSafeInteger(points) && points >= 0 && points <= 10000
    ? points
    : null;
}
export function ratesToDraft(rates?: UnitSalesRecord["rates"]): FeeDraft {
  return Object.fromEntries(
    feeMethods.map((m) => [
      m,
      rates?.[m] == null ? "" : (rates[m]! / 100).toFixed(2).replace(".", ","),
    ]),
  ) as FeeDraft;
}
export function recordToDraft(record: UnitSalesRecord): UnitSalesDraft {
  const draft = emptyUnitSales(ratesToDraft(record.rates));
  draft.date = record.date;
  if (!record.receipts || record.legacyTotals)
    draft.legacyTotals = structuredClone(
      record.legacyTotals ?? {
        values: record.values,
        total: record.total,
        count: record.count,
      },
    );
  draft.values = Object.fromEntries(
    units.map((u) => [
      u.id,
      record.values[u.id] == null
        ? ""
        : (record.values[u.id]! / 100).toFixed(2),
    ]),
  ) as UnitSalesDraft["values"];
  if (record.receipts)
    draft.receipts = Object.fromEntries(
      units.map((u) => [
        u.id,
        Object.fromEntries(
          paymentMethods.map((m) => [
            m.id,
            record.receipts![u.id][m.id] == null
              ? ""
              : (record.receipts![u.id][m.id]! / 100).toFixed(2),
          ]),
        ),
      ]),
    ) as UnitPayments<string>;
  return draft;
}
export function unitSalesSummary(draft: UnitSalesDraft) {
  const raw = draft.receipts ?? blankPayments();
  const rates = Object.fromEntries(
    feeMethods.map((m) => [m, ratePoints(draft.rates?.[m] ?? "")]),
  ) as NonNullable<UnitSalesRecord["rates"]>;
  const invalidRates = feeMethods.filter(
    (m) => (draft.rates?.[m] ?? "").trim() && rates[m] === null,
  );
  const invalidFields: { unit: UnitId; method: PaymentId }[] = [];
  const receipts = Object.fromEntries(
    units.map((u) => [
      u.id,
      Object.fromEntries(
        paymentMethods.map((m) => {
          const text = raw[u.id]?.[m.id]?.trim() ?? "";
          const amount = text ? cents(text) : null;
          if (text && amount === null)
            invalidFields.push({ unit: u.id, method: m.id });
          return [m.id, amount];
        }),
      ),
    ]),
  ) as UnitPayments<number | null>;
  const unitSummaries = units.map((u) => {
    const amounts = receipts[u.id];
    const count = Object.values(amounts).filter((v) => v !== null).length;
    const gross = count
      ? Object.values(amounts).reduce<number>((n, v) => n + (v ?? 0), 0)
      : null;
    const invalid = invalidFields.some((f) => f.unit === u.id);
    const missingRates = feeMethods.filter(
      (m) => (amounts[m] ?? 0) > 0 && rates[m] === null,
    );
    const complete = count === 4 && !invalid;
    const fees =
      complete && !missingRates.length && !invalidRates.length
        ? feeMethods.reduce(
            (n, m) =>
              n + Math.round(((amounts[m] ?? 0) * (rates[m] ?? 0)) / 10000),
            0,
          )
        : null;
    return {
      id: u.id,
      count,
      gross: invalid ? null : gross,
      complete,
      fees,
      net: fees === null || gross === null ? null : gross - fees,
      missingRates,
    };
  });
  const values = Object.fromEntries(
    unitSummaries.map((u) => [u.id, u.gross]),
  ) as UnitSalesRecord["values"];
  const invalid = units.filter((u) =>
    invalidFields.some((f) => f.unit === u.id),
  );
  const count = unitSummaries.filter((u) => u.count).length;
  const completeCount = unitSummaries.filter((u) => u.complete).length;
  const netUnits = unitSummaries.filter((u) => u.net !== null);
  const netCount = netUnits.length;
  const partialNet = netCount ? netUnits.reduce((n, u) => n + u.net!, 0) : null;
  const partialFees = netCount
    ? netUnits.reduce((n, u) => n + u.fees!, 0)
    : null;
  return {
    values,
    receipts,
    rates,
    count,
    completeCount,
    unitSummaries,
    invalid,
    invalidFields,
    invalidRates,
    receiptCount: unitSummaries.reduce((n, u) => n + u.count, 0),
    netCount,
    partialNet,
    partialFees,
    feesTotal: netCount === 6 ? partialFees : null,
    netTotal: netCount === 6 ? partialNet : null,
    total:
      invalid.length || !count
        ? null
        : Object.values(values).reduce<number>((n, v) => n + (v ?? 0), 0),
  };
}
export function makeUnitSalesRecord(draft: UnitSalesDraft): UnitSalesRecord {
  const s = unitSalesSummary(draft);
  if (unitSalesErrors(draft).length || s.total === null)
    throw new Error("Lançamento inválido");
  return {
    date: draft.date,
    values: s.values,
    total: s.total,
    count: s.count,
    receipts: s.receipts,
    rates: s.rates,
    completeCount: s.completeCount,
    feesTotal: s.feesTotal,
    netTotal: s.netTotal,
    partialFees: s.partialFees,
    partialNet: s.partialNet,
    netCount: s.netCount,
    ...(draft.legacyTotals
      ? { legacyTotals: structuredClone(draft.legacyTotals) }
      : {}),
  };
}
export function unitSalesErrors(draft: UnitSalesDraft) {
  const errors: { field: string; message: string }[] = [];
  const date = new Date(`${draft.date}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== draft.date
  )
    errors.push({
      field: "unit-sales-date",
      message: "Informe uma data válida.",
    });
  const s = unitSalesSummary(draft);
  for (const f of s.invalidFields)
    errors.push({
      field: `unit-sales-${f.unit}-${f.method}`,
      message: `${units.find((u) => u.id === f.unit)!.name} · ${paymentMethods.find((m) => m.id === f.method)!.name}: use um valor de zero ou maior, com até duas casas decimais.`,
    });
  for (const m of s.invalidRates)
    errors.push({
      field: `fee-${m}`,
      message: `Taxa de ${paymentMethods.find((p) => p.id === m)!.name}: informe de 0 a 100%, com até duas casas decimais.`,
    });
  if (!s.count && !s.invalidFields.length)
    errors.push({
      field: "unit-sales-balcao-debito",
      message:
        "Informe pelo menos um recebimento. Use 0,00 quando não houver movimento.",
    });
  return errors;
}
// Só somas com as seis unidades conhecidas podem preencher a conferência geral.
export function sharedReceipts(record: UnitSalesRecord) {
  if (!record.receipts) return null;
  return Object.fromEntries(
    paymentMethods.map((m) => {
      const values = units.map((u) => record.receipts![u.id][m.id]);
      return [
        m.id,
        values.some((v) => v === null)
          ? null
          : values.reduce<number>((n, v) => n + (v ?? 0), 0),
      ];
    }),
  ) as Record<PaymentId, number | null>;
}
