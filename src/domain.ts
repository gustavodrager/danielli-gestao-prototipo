// Funções puras compartilhadas pela interface e pela API. Sem dados reais ou exemplos.
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
export const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
