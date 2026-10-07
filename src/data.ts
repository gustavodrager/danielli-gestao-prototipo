import {
  availableMonths,
  daysCovered,
  monthLabel,
  todayInSaoPaulo,
  type Period,
} from "./months.ts";
export { type Period } from "./months.ts";
export const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const percent = (n: number) =>
  `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
export const units = [
  { id: "balcao", name: "Balcão" },
  { id: "buffet", name: "Buffet" },
  { id: "massas", name: "Massas" },
  { id: "churrasco", name: "Churrasco" },
  { id: "marmita", name: "Marmita" },
  { id: "vitrine", name: "Vitrine" },
] as const;
export const methods = [
  "Dinheiro",
  "Pix",
  "Débito",
  "Crédito",
  "Voucher",
  "iFood",
] as const;
export type Metric = "faturamento" | "cmv" | "despesas" | "pessoal";
export type Scenario = "real" | "regular" | "diferenca" | "vazio";
export const periods = Object.fromEntries(
  availableMonths().map((month) => [month, monthLabel(month)]),
) as Record<Period, string>;
export const metricNames: Record<Metric, string> = {
  faturamento: "Faturamento",
  cmv: "Compras / CMV estimado",
  despesas: "Despesas gerais",
  pessoal: "Pessoal",
};
export interface Entry {
  id: string;
  metric: Metric;
  group: string;
  groupName: string;
  source: string;
  sourceName: string;
  amount: number;
  date: string;
  document: string;
}
// Exemplos determinísticos por dia. Julho nunca é preenchido com exemplos.
const mockCosts = [
  {
    metric: "cmv",
    id: "carnes",
    name: "Carnes",
    base: 1700,
    source: "Fornecedor exemplo A",
  },
  {
    metric: "cmv",
    id: "buffet",
    name: "Buffet",
    base: 1500,
    source: "Fornecedor exemplo B",
  },
  {
    metric: "cmv",
    id: "massas",
    name: "Massas",
    base: 950,
    source: "Fornecedor exemplo C",
  },
  {
    metric: "cmv",
    id: "outros",
    name: "Outros insumos",
    base: 1400,
    source: "Fornecedor exemplo D",
  },
  {
    metric: "despesas",
    id: "ocupacao",
    name: "Ocupação · exemplo",
    base: 400,
    source: "Recibo de exemplo",
  },
  {
    metric: "despesas",
    id: "servicos",
    name: "Serviços · exemplo",
    base: 480,
    source: "Recibo de exemplo",
  },
  {
    metric: "pessoal",
    id: "pessoal",
    name: "Pessoal · total geral",
    base: 2400,
    source: "Planilha de exemplo",
  },
] as const;
function seeded(key: string) {
  let seed = 2166136261;
  for (const char of key) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return (seed >>> 0) / 4294967295;
}
export function mockEntries(
  period: Period,
  today = todayInSaoPaulo(),
): Entry[] {
  if (period === "2026-07" || period < "2026-05") return [];
  const list: Entry[] = [];
  const days = daysCovered(period, today);
  for (let day = 1; day <= days; day++) {
    const date = `${period}-${String(day).padStart(2, "0")}`;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const movement = weekday === 0 || weekday === 6 ? 1.18 : 1;
    const growth =
      1 +
      Math.max(
        0,
        (Number(period.slice(0, 4)) - 2026) * 12 + Number(period.slice(-2)) - 5,
      ) *
        0.025;
    const add = (
      metric: Metric,
      id: string,
      name: string,
      base: number,
      source: string,
    ) => {
      const amount =
        Math.round(
          base * movement * growth * (0.88 + seeded(date + id) * 0.24) * 100,
        ) / 100;
      list.push({
        id: `demo-${date}-${metric}-${id}`,
        metric,
        group: id,
        groupName: name,
        source: `origem-${id}`,
        sourceName: source,
        amount,
        date,
        document: `DEMO-${date}-${metric.toUpperCase()}-${id.toUpperCase()}`,
      });
    };
    units.forEach((unit, i) =>
      add(
        "faturamento",
        unit.id,
        unit.name,
        [2400, 9700, 1400, 2800, 2100, 1100][i],
        "Registro diário fictício",
      ),
    );
    mockCosts.forEach((cost) =>
      add(cost.metric, cost.id, cost.name, cost.base, cost.source),
    );
  }
  return list;
}
export const entries = mockEntries("2026-09", "2026-09-30");
export function periodEntries(
  period: Period,
  scenario: Scenario,
  today = todayInSaoPaulo(),
) {
  return scenario === "vazio" || period === "2026-07"
    ? []
    : mockEntries(period, today);
}
export const sum = (values: number[]) =>
  values.reduce((a, b) => a + Math.round(b * 100), 0) / 100;
export function totals(list: Entry[]) {
  const total = (metric: Metric) =>
    sum(list.filter((e) => e.metric === metric).map((e) => e.amount));
  const revenue = total("faturamento"),
    purchases = total("cmv"),
    expenses = total("despesas"),
    staff = total("pessoal");
  return {
    revenue,
    purchases,
    expenses,
    staff,
    result: sum([revenue, -purchases, -expenses, -staff]),
    cmvPercent: revenue ? (purchases / revenue) * 100 : null,
    primeCost: revenue ? ((purchases + staff) / revenue) * 100 : null,
  };
}
export interface CashDraft {
  localId?: string;
  date: string;
  responsible: string;
  reviewer: string;
  sales: string;
  receipts: Record<string, string>;
  units: Record<string, string>;
  outflows: { id: number; description: string; amount: string }[];
  notes: string;
}
export function emptyDraft(): CashDraft {
  return {
    date: new Date().toLocaleDateString("sv-SE", {
      timeZone: "America/Sao_Paulo",
    }),
    responsible: "",
    reviewer: "",
    sales: "",
    receipts: Object.fromEntries(methods.map((m) => [m, ""])),
    units: Object.fromEntries(units.map((u) => [u.id, ""])),
    outflows: [],
    notes: "",
  };
}
export function exampleDraft(scenario: Scenario): CashDraft {
  return {
    ...emptyDraft(),
    responsible: "Responsável exemplo",
    reviewer: "Conferente exemplo",
    sales: "8870,00",
    receipts: Object.fromEntries(
      methods.map((m, i) => [
        m,
        [
          "1420,00",
          "2900,00",
          "1900,00",
          scenario === "diferenca" ? "2168,00" : "2200,00",
          "150,00",
          "300,00",
        ][i],
      ]),
    ),
    units: {
      balcao: "1560,00",
      buffet: "2640,00",
      massas: "1500,00",
      churrasco: "1400,00",
      marmita: "1000,00",
      vitrine: "770,00",
    },
    outflows: [
      {
        id: 1,
        description: "Saída de exemplo · recibo DEMO-S01",
        amount: "120,00",
      },
    ],
    notes: "Exemplo fictício para apresentar o fechamento.",
  };
}
// Converte reais para centavos antes de somar: evita diferenças por ponto flutuante.
export function cents(value: string): number | null {
  const cleaned = value.trim().replace(/^R\$\s*/, "");
  if (!cleaned) return value.trim() ? null : 0;
  if (
    cleaned.includes(",") &&
    !/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(cleaned)
  )
    return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(?:\.\d{3})+$/.test(cleaned)
      ? cleaned.replace(/\./g, "")
      : cleaned;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(amount) && amount <= 99999999999 ? amount : null;
}
export function observedCents(value: string): number | null {
  return value.trim() ? cents(value) : null;
}
export function cashTotals(draft: CashDraft) {
  const receipts = sum(Object.values(draft.receipts).map((v) => cents(v) ?? 0));
  const sales = cents(draft.sales) ?? 0;
  const mix = sum(Object.values(draft.units).map((v) => cents(v) ?? 0));
  const outflows = sum(draft.outflows.map((o) => cents(o.amount) ?? 0));
  const receiptCount = Object.values(draft.receipts).filter(
    (v) => observedCents(v) !== null,
  ).length;
  const unitCount = Object.values(draft.units).filter(
    (v) => observedCents(v) !== null,
  ).length;
  const difference =
    receiptCount === methods.length && observedCents(draft.sales) !== null
      ? receipts - sales
      : null;
  return {
    receipts,
    sales,
    mix,
    outflows,
    receiptCount,
    unitCount,
    difference,
  };
}
export function cashErrors(draft: CashDraft): string[] {
  const errors: string[] = [];
  if (!draft.date || draft.date < "2000-01-01" || draft.date > "2099-12-31")
    errors.push("Informe uma data válida entre 2000 e 2099.");
  if (!draft.responsible.trim())
    errors.push("Informe quem realizou o fechamento.");
  if (!draft.sales.trim() || cents(draft.sales) === null)
    errors.push("Informe um total de vendas válido.");
  if (
    ![...Object.values(draft.receipts), ...Object.values(draft.units)].every(
      (v) => cents(v) !== null,
    )
  )
    errors.push(
      "Revise os valores: use números positivos e até duas casas decimais.",
    );
  if (
    draft.outflows.some(
      (o) =>
        !o.description.trim() ||
        !o.amount.trim() ||
        cents(o.amount) === null ||
        cents(o.amount) === 0,
    )
  )
    errors.push(
      "Preencha a descrição e um valor maior que zero para cada saída, ou remova a linha.",
    );
  return errors;
}
export const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
