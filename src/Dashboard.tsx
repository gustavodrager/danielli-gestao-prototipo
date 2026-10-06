import { Link } from "react-router-dom";
import { useDemo } from "./demo-context";
import {
  money,
  percent,
  periodEntries,
  periods,
  sum,
  totals,
  trend,
  units,
} from "./data";
import { Badge, Empty, Icon, Note, PeriodSelect, RowLink } from "./ui";
export default function Dashboard() {
  const { entries, period, scenario, closed } = useDemo();
  const t = totals(entries);
  const previous = totals(periodEntries("2026-08", "regular"));
  const growth = (t.revenue / previous.revenue - 1) * 100;
  return (
    <>
      <div className="welcome">
        <span className="eyebrow">GESTÃO COM CLAREZA</span>
        <h1>
          Seu negócio,
          <br />
          <em>em perspectiva.</em>
        </h1>
        <p>Do número à origem. Tudo ao seu alcance.</p>
      </div>
      <PeriodSelect />
      <div className="period-caption">
        <span>Histórico de exemplo</span>
        <Link to="/mais#qualidade">
          Como ler estes dados <span aria-hidden="true">↗</span>
        </Link>
      </div>
      {!entries.length ? (
        <Empty />
      ) : (
        <>
          <Link className="hero metric-link" to="/indicadores/faturamento">
            <div className="row">
              <span className="eyebrow">FATURAMENTO</span>
              <Icon name="arrow" />
            </div>
            <strong className="hero-value">{money(t.revenue)}</strong>
            <div className="row">
              <span className="growth">
                {period === "2026-09"
                  ? `↗ ${percent(growth)} vs agosto`
                  : "Comparação anterior indisponível"}
              </span>
              <Badge kind="calculado" />
            </div>
            <div className="hero-bottom">
              <span>
                Média por dia calendário{" "}
                <b>{money(t.revenue / (period === "2026-09" ? 30 : 31))}</b>
              </span>
              <span>Ver composição ↗</span>
            </div>
          </Link>
          <div className="metric-grid">
            <Link className="metric panel" to="/indicadores/cmv">
              <span className="eyebrow">CMV ESTIMADO</span>
              <strong>{percent(t.cmvPercent!)}</strong>
              <span>Compras {money(t.purchases)}</span>
              <Badge kind="estimado" />
              <span className="metric-action">
                Entender composição <Icon name="arrow" size={14} />
              </span>
            </Link>
            <Link className="metric panel" to="/indicadores/despesas">
              <span className="eyebrow">DESPESAS GERAIS</span>
              <strong>{money(t.expenses)}</strong>
              <span>Sem rateio por unidade</span>
              <Badge kind="calculado" />
              <span className="metric-action">
                Ver despesas <Icon name="arrow" size={14} />
              </span>
            </Link>
          </div>
          <Link className="result metric-link" to="/indicadores/resultado">
            <div className="row">
              <span className="eyebrow">RESULTADO GERENCIAL</span>
              <Badge kind="estimado" />
            </div>
            <div className="row">
              <strong>{money(t.result)}</strong>
              <Icon name="arrow" />
            </div>
            <span>
              {percent((t.result / t.revenue) * 100)} do faturamento · após
              compras, despesas e pessoal
            </span>
          </Link>
          <div className="panel compact">
            <RowLink
              to="/indicadores/pessoal"
              title="Pessoal"
              subtitle="Total geral do período"
              value={money(t.staff)}
            />
            <RowLink
              to="/indicadores/prime-cost"
              title="CMV + Pessoal estimado"
              subtitle="Compras + pessoal / faturamento"
              value={percent(t.primeCost!)}
            />
          </div>
          <Note>
            <b>Uma leitura inicial, com transparência.</b> As compras são uma
            aproximação do CMV. Sem estoques inicial e final, CMV, resultado e
            CMV + Pessoal permanecem estimados.
          </Note>
          <section className="panel">
            <div className="section-title">
              <div>
                <span className="eyebrow">HISTÓRICO FICTÍCIO</span>
                <h2>O movimento do negócio</h2>
              </div>
              <Badge kind="calculado" />
            </div>
            <p className="muted">Faturamento · abril a setembro de 2026</p>
            <div
              className="chart"
              role="img"
              aria-label={trend
                .map(
                  (p) =>
                    `${p.label}: ${p.value === null ? "sem dados" : money(p.value)}`,
                )
                .join("; ")}
            >
              {trend.map((p) => (
                <div
                  className={`chart-column ${p.label === (period === "2026-09" ? "Set" : "Ago") ? "selected" : ""}`}
                  key={p.label}
                >
                  <span className="chart-value">
                    {p.value === null
                      ? "—"
                      : `${Math.round(p.value / 1000)} mil`}
                  </span>
                  <div className="bar-space">
                    <div
                      className={
                        p.value === null ? "chart-missing" : "chart-bar"
                      }
                      style={
                        p.value === null
                          ? undefined
                          : { height: `${(p.value / 190000) * 100}%` }
                      }
                    />
                  </div>
                  <span>{p.label}</span>
                </div>
              ))}
            </div>
            <p className="chart-note">
              Julho sem dados importados. Não representa faturamento zero.
            </p>
          </section>
          <section className="panel">
            <div className="section-title">
              <div>
                <span className="eyebrow">ORIGEM DO FATURAMENTO</span>
                <h2>Faturamento por unidade</h2>
              </div>
              <Link className="text-link" to="/indicadores/faturamento">
                Detalhar ↗
              </Link>
            </div>
            <p className="muted">Participação das unidades no faturamento</p>
            {units.map((u) => {
              const value = sum(
                entries
                  .filter((e) => e.metric === "faturamento" && e.group === u.id)
                  .map((e) => e.amount),
              );
              return (
                <RowLink
                  key={u.id}
                  to={`/indicadores/faturamento/${u.id}`}
                  title={u.name}
                  subtitle={`${percent((value / t.revenue) * 100)} do faturamento`}
                  value={money(value)}
                />
              );
            })}
            <p className="chart-note">
              Valores fictícios por unidade. A relação com as cores das comandas
              será validada com Higor.
            </p>
          </section>
        </>
      )}
      <section className="panel cash-teaser">
        <div className="section-title">
          <div>
            <span className="eyebrow">ROTINA DO CAIXA</span>
            <h2>Fechamento de exemplo</h2>
          </div>
          <Icon name="cash" />
        </div>
        <p>
          {closed
            ? "Você concluiu uma simulação nesta sessão."
            : "05 out 2026 · pronto para simular"}
        </p>
        {scenario === "diferenca" && !closed ? (
          <Note tone="warning">
            Exemplo com R$ 32,00 a menos nos recebimentos. Explore a
            conferência.
          </Note>
        ) : null}
        <Link className="primary" to="/caixa">
          {closed ? "Ver simulação concluída" : "Explorar o caixa"}{" "}
          <Icon name="arrow" size={16} />
        </Link>
      </section>
      <div className="demo-story">
        <Icon name="spark" />
        <div>
          <b>Comece pelo que já existe.</b>
          <p>
            Organize o histórico, enxergue os números e aprofunde a gestão no
            seu ritmo.
          </p>
          <Link to="/mais">Conhecer a implantação gradual ↗</Link>
        </div>
      </div>
      <span className="sr-only">Período selecionado: {periods[period]}</span>
    </>
  );
}
