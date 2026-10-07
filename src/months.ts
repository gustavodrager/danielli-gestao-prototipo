export type Period = `${number}-${string}`;
export function todayInSaoPaulo(now = new Date()) {
  return now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
export function currentMonth(now = new Date()): Period {
  return todayInSaoPaulo(now).slice(0, 7) as Period;
}
export function availableMonths(today = todayInSaoPaulo()): Period[] {
  const end = today.slice(0, 7);
  const months: Period[] = [];
  for (
    let date = new Date("2026-05-01T12:00:00Z");
    date.toISOString().slice(0, 7) <= end;
    date.setUTCMonth(date.getUTCMonth() + 1)
  )
    months.push(date.toISOString().slice(0, 7) as Period);
  return months;
}
export function monthLabel(month: string, short = false) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-BR", {
    month: short ? "short" : "long",
    ...(short ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}
export function daysCovered(month: string, today = todayInSaoPaulo()) {
  if (!/^\d{4}-\d{2}$/.test(month) || month > today.slice(0, 7)) return 0;
  const [year, number] = month.split("-").map(Number);
  if (number < 1 || number > 12) return 0;
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return month === today.slice(0, 7)
    ? Math.min(Number(today.slice(-2)), days)
    : days;
}
export function previousMonth(month: string): Period {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7) as Period;
}
export function withMonth(to: string, month: Period) {
  if (!to.startsWith("/") || to.startsWith("//")) return to;
  const url = new URL(to, "https://danielli.local");
  if (!url.searchParams.has("mes")) url.searchParams.set("mes", month);
  return url.pathname + url.search + url.hash;
}
