import { Link, useLocation, useParams } from "react-router-dom";
import { useDemo } from "./demo-context";
import {
  dateLabel,
  metricNames,
  money,
  percent,
  periods,
  sum,
  totals,
  type Metric,
} from "./data";
import { Back, Badge, Empty, Icon, Note, PeriodSelect, RowLink } from "./ui";
import { RealIndicator } from "./Real";
const metrics = Object.keys(metricNames);
export function Indicator() {
  const { tipo = "", grupo, origem } = useParams();
  const { entries, period, scenario } = useDemo();
  if (scenario === "real") return <RealIndicator />;
  const t = totals(entries);
  const calculated = tipo === "resultado" || tipo === "prime-cost";
  if (!metrics.includes(tipo) && !calculated)
    return (
      <>
        <Back to="/">Visão geral</Back>
        <h1>Indicador não encontrado</h1>
      </>
    );
  const name = calculated
    ? tipo === "resultado"
      ? "Resultado gerencial"
      : "CMV + Pessoal estimado"
    : metricNames[tipo as Metric];
  const list = entries.filter(
    (e) =>
      e.metric === tipo &&
      (!grupo || e.group === grupo) &&
      (!origem || e.source === origem),
  );
  const showEntries =
    !!origem ||
    tipo === "pessoal" ||
    (!!grupo && new Set(list.map((e) => e.source)).size === 1);
  const heading = origem
    ? list[0]?.sourceName
    : grupo
      ? list[0]?.groupName
      : name;
  const base = `/indicadores/${tipo}`;
  const parent = origem ? `${base}/${grupo}` : grupo ? base : "/";
  const value = calculated
    ? tipo === "resultado"
      ? money(t.result)
      : t.primeCost === null
        ? "—"
        : percent(t.primeCost)
    : money(sum(list.map((e) => e.amount)));
  return (
    <>
      <Back to={parent}>
        {origem ? list[0]?.groupName || name : grupo ? name : "Visão geral"}
      </Back>
      <div className="breadcrumbs" aria-label="Caminho do detalhamento">
        Resumo <span>›</span> Composição{" "}
        {grupo ? (
          <>
            <span>›</span> {list[0]?.groupName}
          </>
        ) : null}
        {origem ? (
          <>
            <span>›</span> {list[0]?.sourceName}
          </>
        ) : null}
      </div>
      <h1>{heading || name}</h1>
      <PeriodSelect />
      {!entries.length ? (
        <Empty />
      ) : !calculated && !list.length ? (
        <Note>
          Este detalhamento não está disponível.{" "}
          <Link to={base}>Voltar ao indicador</Link>.
        </Note>
      ) : (
        <>
          <section className="detail-hero">
            <span className="eyebrow">
              {heading || name} · {periods[period]}
            </span>
            <strong>{value}</strong>
            <Badge kind={calculated ? "estimado" : "calculado"} />
            {tipo === "cmv" ? (
              <span>
                {t.revenue
                  ? percent((sum(list.map((e) => e.amount)) / t.revenue) * 100)
                  : "—"}{" "}
                do faturamento geral · compras deste recorte
              </span>
            ) : null}
          </section>
          {tipo === "cmv" ? (
            <details className="panel">
              <summary>Como este número foi formado</summary>
              <Note tone="warning">
                <b>Soma calculada de compras; aproximação estimada de CMV.</b> O
                valor soma os documentos fictícios de compra. Estoques e consumo
                não estão disponíveis. Categorias ilustram o acompanhamento
                atual e não rateiam custos entre unidades.
              </Note>
            </details>
          ) : null}
          {tipo === "despesas" || tipo === "pessoal" ? (
            <Note>
              Valores gerais da Danielli. As categorias de exemplo devem ser
              confirmadas com Higor. Não há rateio por unidade de negócio.
            </Note>
          ) : null}
          {calculated ? (
            <>
              <h2>Como chegamos a este número</h2>
              <div className="panel compact">
                {tipo === "resultado" ? (
                  <RowLink
                    to="/indicadores/faturamento"
                    title="Faturamento"
                    subtitle="Soma dos lançamentos de exemplo"
                    value={money(t.revenue)}
                  />
                ) : null}
                <RowLink
                  to="/indicadores/cmv"
                  title="Compras"
                  subtitle="Aproximação do CMV"
                  value={`${tipo === "resultado" ? "− " : ""}${money(t.purchases)}`}
                />
                {tipo === "resultado" ? (
                  <RowLink
                    to="/indicadores/despesas"
                    title="Despesas gerais"
                    value={`− ${money(t.expenses)}`}
                  />
                ) : null}
                <RowLink
                  to="/indicadores/pessoal"
                  title="Pessoal"
                  value={`${tipo === "resultado" ? "− " : "+ "}${money(t.staff)}`}
                />
                {tipo === "prime-cost" ? (
                  <RowLink
                    to="/indicadores/faturamento"
                    title="Dividido pelo faturamento"
                    value={money(t.revenue)}
                  />
                ) : null}
              </div>
              <Note tone="warning">
                {tipo === "resultado"
                  ? "Faturamento − compras − despesas gerais − pessoal."
                  : "(Compras + pessoal) ÷ faturamento × 100."}{" "}
                Fórmula ilustrativa: depende do CMV estimado e da cobertura dos
                dados. Validar a metodologia gerencial e o conteúdo de pessoal
                com Higor.
              </Note>
            </>
          ) : (
            <>
              <h2>
                {showEntries
                  ? "Lançamentos de exemplo"
                  : grupo
                    ? "Fornecedor / origem"
                    : tipo === "faturamento"
                      ? "Composição por unidade"
                      : "Composição por categoria"}
              </h2>
              <div className="panel compact">
                {showEntries
                  ? list.map((e) => (
                      <RowLink
                        key={e.id}
                        to={`/lancamentos/${e.id}`}
                        title={e.document}
                        subtitle={`${dateLabel(e.date)} · ${e.metric === "faturamento" ? "Resumo histórico agregado" : "Lançamento fictício"}`}
                        value={money(e.amount)}
                      />
                    ))
                  : Array.from(
                      new Set(list.map((e) => (grupo ? e.source : e.group))),
                    ).map((id) => {
                      const items = list.filter((e) =>
                        grupo ? e.source === id : e.group === id,
                      );
                      return (
                        <RowLink
                          key={id}
                          to={
                            grupo
                              ? `${base}/${grupo}/origens/${id}`
                              : `${base}/${id}`
                          }
                          title={
                            grupo ? items[0].sourceName : items[0].groupName
                          }
                          subtitle={`${items.length} lançamento${items.length > 1 ? "s" : ""} de exemplo`}
                          value={money(sum(items.map((e) => e.amount)))}
                        />
                      );
                    })}
              </div>
              <p className="hint">
                Toque em uma linha para seguir até o documento de origem.
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
export function EntryDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { entries } = useDemo();
  const entry = entries.find((e) => e.id === id);
  if (!entry)
    return (
      <>
        <Back to="/">Visão geral</Back>
        <h1>Lançamento indisponível</h1>
        <Empty text="Este lançamento não pertence ao cenário ou período selecionado." />
      </>
    );
  const back = `/indicadores/${entry.metric}/${entry.group}/origens/${entry.source}`;
  return (
    <>
      <Back to={location.state?.returnTo || back}>
        {location.state?.returnName || "Lançamentos"}
      </Back>
      <span className="eyebrow">RASTREABILIDADE · EXEMPLO</span>
      <h1>{entry.document}</h1>
      <section className="detail-hero">
        <strong>{money(entry.amount)}</strong>
        <Badge kind="observado" />
        <span>Registro fictício de {dateLabel(entry.date)}</span>
      </section>
      <dl className="panel fact-list">
        <div>
          <dt>Categoria / unidade</dt>
          <dd>{entry.groupName}</dd>
        </div>
        <div>
          <dt>Fornecedor / origem</dt>
          <dd>{entry.sourceName}</dd>
        </div>
        <div>
          <dt>Registro</dt>
          <dd>
            {entry.metric === "faturamento"
              ? "Resumo histórico agregado de exemplo"
              : "Lançamento de exemplo"}
          </dd>
        </div>
      </dl>
      <details className="document-panel">
        <summary>
          <Icon name="document" />
          Ver documento de origem <Icon name="arrow" size={16} />
        </summary>
        <div className="document-preview">
          <span className="document-watermark">FICTÍCIO</span>
          <span className="eyebrow">DOCUMENTO DEMONSTRATIVO</span>
          <h2>{entry.sourceName}</h2>
          <p>Referência: {entry.document}</p>
          <p>Data: {dateLabel(entry.date)}</p>
          <p>Descrição: {entry.groupName}</p>
          <div className="document-total">
            Valor registrado <strong>{money(entry.amount)}</strong>
          </div>
          <p className="hint">
            Representação textual criada para demonstrar a consulta. Não é uma
            foto ou documento original da Danielli.
          </p>
        </div>
      </details>
      <Note>
        Na implantação, este espaço poderá exibir a foto, nota ou planilha que
        originou o lançamento. O protótipo utiliza somente exemplos.
      </Note>
    </>
  );
}
