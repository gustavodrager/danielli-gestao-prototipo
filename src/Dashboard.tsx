import { Link } from "./navigation";
import { useSearchParams } from "react-router-dom";
import { useDemo } from "./demo-context";
import { money, percent, sum, totals, units, mockEntries } from "./data";
import {
  daysCovered,
  previousMonth,
  todayInSaoPaulo,
  monthLabel,
} from "./months";
import { Badge, Empty, Icon, Note, PeriodSelect, RowLink } from "./ui";
import { RealDashboard } from "./Real";
import UnitSales from "./UnitSales";
import PurchaseInput from "./PurchaseInput";
export default function Dashboard() {
  const { entries, period, scenario, profile } = useDemo();
  const [params, setParams] = useSearchParams();
  if (profile === "caixa") return <UnitSales />;
  if (profile === "compras") return <PurchaseInput />;
  if (scenario === "real")
    return (
      <>
        <RealDashboard />
        <Link className="secondary" to="/simulacao">
          Ver indicadores dos registros locais · simulação
        </Link>
      </>
    );
  const t = totals(entries);
  const today = todayInSaoPaulo(),
    days = daysCovered(period),
    prior = previousMonth(period);
  const partial = period === today.slice(0, 7);
  const comparable =
    prior >= "2026-05" &&
    prior !== "2026-07" &&
    (!partial || days <= daysCovered(prior));
  const previous = totals(
    mockEntries(prior).filter(
      (e) => !partial || Number(e.date.slice(-2)) <= days,
    ),
  );
  const daily = Array.from(new Set(entries.map((e) => e.date))).map((date) => ({
    date,
    value: sum(
      entries
        .filter((e) => e.date === date && e.metric === "faturamento")
        .map((e) => e.amount),
    ),
  }));
  const max = Math.max(1, ...daily.map((d) => d.value));
  const selected =
    daily.find((d) => d.date === params.get("dia")) ??
    daily.filter((d) => d.date < today).at(-1);
  return (
    <>
      <h1>Visão geral</h1>
      <PeriodSelect />
      <div className="period-caption">
        <span>Dados fictícios · demonstração</span>
        <Link to="/mais#qualidade">Fontes e cobertura ↗</Link>
      </div>
      {!entries.length ? (
        <Empty />
      ) : (
        <>
          <Link className="hero metric-link" to="/indicadores/faturamento">
            <div className="row">
              <span className="eyebrow">VENDAS BRUTAS · EXEMPLO</span>
              <Icon name="arrow" />
            </div>
            <strong className="hero-value">{money(t.revenue)}</strong>
            <div className="row">
              <span className="growth">
                {comparable && previous.revenue
                  ? `${percent((t.revenue / previous.revenue - 1) * 100)} vs ${monthLabel(prior, true)} · ${partial ? `dias 1 a ${days}` : "mês completo"}`
                  : "Comparação indisponível por origem ou cobertura"}
              </span>
              <Badge kind="calculado" />
            </div>
            <div className="hero-bottom">
              <span>
                Média dos {days} dias cobertos <b>{money(t.revenue / days)}</b>
              </span>
              <span>Ver composição ↗</span>
            </div>
          </Link>
          <section className="panel">
            <div className="section-title">
              <div>
                <span className="eyebrow">
                  ORIGEM DO FATURAMENTO · FICTÍCIO
                </span>
                <h2>Vendas por unidade</h2>
              </div>
              <Link className="text-link" to="/indicadores/faturamento">
                Detalhar ↗
              </Link>
            </div>
            {units.map((u) => {
              const v = sum(
                entries
                  .filter((e) => e.metric === "faturamento" && e.group === u.id)
                  .map((e) => e.amount),
              );
              return (
                <RowLink
                  key={u.id}
                  to={`/indicadores/faturamento/${u.id}`}
                  title={u.name}
                  subtitle={`${percent((v / t.revenue) * 100)} do total fictício · ${days} dias`}
                  value={money(v)}
                />
              );
            })}
            <p className="chart-note">
              Unidades representam origem da receita. As cores das comandas
              ainda dependem de Higor.
            </p>
          </section>
          <section className="panel">
            <div className="section-title">
              <div>
                <span className="eyebrow">
                  MOVIMENTO DIÁRIO · DADOS FICTÍCIOS
                </span>
                <h2>
                  {monthLabel(period)}
                  {period === today.slice(0, 7)
                    ? ` · até ${today.slice(-2)}/${today.slice(5, 7)}`
                    : ""}
                </h2>
              </div>
              <Badge kind="calculado" />
            </div>
            <div
              className="daily-chart"
              role="group"
              aria-label="Vendas fictícias por dia"
            >
              {daily.map((d) => (
                <button
                  type="button"
                  key={d.date}
                  aria-label={`${d.date.slice(-2)}/${d.date.slice(5, 7)} · ${money(d.value)} · fictício`}
                  aria-pressed={selected?.date === d.date}
                  style={{ height: `${(d.value / max) * 100}%` }}
                  onClick={() =>
                    setParams(
                      (current) => {
                        const next = new URLSearchParams(current);
                        next.set("mes", period);
                        next.set("dia", d.date);
                        return next;
                      },
                      { replace: true },
                    )
                  }
                >
                  <span className="chart-day" aria-hidden="true">
                    {d.date.slice(-2)}
                  </span>
                </button>
              ))}
            </div>
            {selected ? (
              <div className="chart-selection" aria-live="polite">
                <b>
                  {selected.date.slice(-2)}/{selected.date.slice(5, 7)} ·{" "}
                  {money(selected.value)} · fictício
                </b>
                <RowLink
                  to={`/dias/${selected.date}`}
                  title="Abrir registros do dia"
                />
              </div>
            ) : null}
            <p className="chart-note">
              Toque em um dia para conferir as seis unidades e os lançamentos.
              Nenhum valor após a data atual.
            </p>
          </section>
          <div className="metric-grid">
            <Link className="metric panel" to="/indicadores/cmv">
              <span className="eyebrow">CMV ESTIMADO · FICTÍCIO</span>
              <strong>{percent(t.cmvPercent!)}</strong>
              <span>Compras {money(t.purchases)}</span>
              <Badge kind="estimado" />
              <span className="metric-action">Ver compras ↗</span>
            </Link>
            <Link className="metric panel" to="/indicadores/despesas">
              <span className="eyebrow">DESPESAS GERAIS · FICTÍCIO</span>
              <strong>{money(t.expenses)}</strong>
              <span>Sem rateio por unidade</span>
              <Badge kind="calculado" />
              <span className="metric-action">Ver despesas ↗</span>
            </Link>
          </div>
          <Link className="result metric-link" to="/indicadores/resultado">
            <div className="row">
              <span className="eyebrow">RESULTADO GERENCIAL · FICTÍCIO</span>
              <Badge kind="estimado" />
            </div>
            <div className="row">
              <strong>{money(t.result)}</strong>
              <Icon name="arrow" />
            </div>
            <span>
              {percent((t.result / t.revenue) * 100)} do faturamento · fórmula
              ilustrativa
            </span>
          </Link>
          <div className="panel compact">
            <RowLink
              to="/indicadores/pessoal"
              title="Pessoal"
              subtitle="Total geral fictício"
              value={money(t.staff)}
            />
            <RowLink
              to="/indicadores/prime-cost"
              title="CMV + Pessoal estimado"
              subtitle="Compras + pessoal / faturamento · fictício"
              value={percent(t.primeCost!)}
            />
          </div>
          <Note>
            Compras aproximam CMV. Sem estoques inicial e final, CMV e resultado
            permanecem estimados, mesmo nos exemplos.
          </Note>
        </>
      )}
    </>
  );
}
