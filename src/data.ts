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
export type Period = "2026-09" | "2026-08" | "2026-07";
export type Scenario = "real" | "regular" | "diferenca" | "vazio";
export const periods: Record<Period, string> = {
  "2026-09": "Setembro 2026",
  "2026-08": "Agosto 2026",
  "2026-07": "Julho 2026",
};
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
// Unidades confirmadas pelo usuário; valores, origens e documentos são fictícios.
const groups: {
  metric: Metric;
  id: string;
  name: string;
  source: string;
  values: number[];
}[] = [
  {
    metric: "faturamento",
    id: "balcao",
    name: "Balcão",
    source: "Livro de fechamento",
    values: [16200, 16200],
  },
  {
    metric: "faturamento",
    id: "buffet",
    name: "Buffet",
    source: "Livro de fechamento",
    values: [27350, 27350],
  },
  {
    metric: "faturamento",
    id: "massas",
    name: "Massas",
    source: "Livro de fechamento",
    values: [15600, 15600],
  },
  {
    metric: "faturamento",
    id: "churrasco",
    name: "Churrasco",
    source: "Livro de fechamento",
    values: [13000, 13000],
  },
  {
    metric: "faturamento",
    id: "marmita",
    name: "Marmita",
    source: "Livro de fechamento",
    values: [12000, 12000],
  },
  {
    metric: "faturamento",
    id: "vitrine",
    name: "Vitrine",
    source: "Livro de fechamento",
    values: [8010, 8010],
  },
  {
    metric: "cmv",
    id: "carnes",
    name: "Carnes",
    source: "Fornecedor exemplo A",
    values: [9215, 9215],
  },
  {
    metric: "cmv",
    id: "buffet",
    name: "Buffet",
    source: "Fornecedor exemplo B",
    values: [8105, 8105],
  },
  {
    metric: "cmv",
    id: "massas",
    name: "Massas",
    source: "Fornecedor exemplo C",
    values: [4920, 4920],
  },
  {
    metric: "cmv",
    id: "outros",
    name: "Outros insumos",
    source: "Fornecedor exemplo D",
    values: [7615, 7615],
  },
  {
    metric: "despesas",
    id: "ocupacao",
    name: "Ocupação · exemplo",
    source: "Recibos de exemplo",
    values: [12000],
  },
  {
    metric: "despesas",
    id: "servicos",
    name: "Serviços · exemplo",
    source: "Contas de exemplo",
    values: [9450],
  },
  {
    metric: "despesas",
    id: "outras",
    name: "Outras despesas · exemplo",
    source: "Livro de despesas",
    values: [7000],
  },
  {
    metric: "pessoal",
    id: "pessoal",
    name: "Pessoal · total geral",
    source: "Planilha de exemplo",
    values: [41200],
  },
];
export const entries: Entry[] = groups.flatMap((g) =>
  g.values.map((amount, i) => ({
    id: `${g.metric}-${g.id}-${i + 1}`,
    metric: g.metric,
    group: g.id,
    groupName: g.name,
    source: `origem-${g.id}`,
    sourceName: g.source,
    amount,
    date: i === 0 ? "2026-09-15" : "2026-09-30",
    document: `DEMO-${g.metric === "faturamento" ? "RECEITA-" : ""}${g.id.toUpperCase()}-${i + 1}`,
  })),
);
export function periodEntries(period: Period, scenario: Scenario) {
  if (scenario === "real") return [];
  if (period === "2026-07" || scenario === "vazio") return [];
  if (period === "2026-09") return entries;
  return entries.map((e) => ({
    ...e,
    amount: Math.round(
      e.amount /
        (e.metric === "faturamento"
          ? 1.084
          : e.metric === "cmv"
            ? 1.128
            : 1.03),
    ),
    date: e.date.replace("2026-09", "2026-08"),
  }));
}
export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
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
    result: revenue - purchases - expenses - staff,
    cmvPercent: revenue ? (purchases / revenue) * 100 : null,
    primeCost: revenue ? ((purchases + staff) / revenue) * 100 : null,
  };
}
export const trend = [
  { label: "Abr", value: 142100 },
  { label: "Mai", value: 158900 },
  { label: "Jun", value: 153700 },
  { label: "Jul", value: null },
  { label: "Ago", value: totals(periodEntries("2026-08", "regular")).revenue },
  { label: "Set", value: totals(entries).revenue },
];
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
