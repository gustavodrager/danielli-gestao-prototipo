import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { dateLabel, metricNames, money, units, type Metric } from "./data";
import {
  realCash,
  realTotal,
  realUnitTotal,
  realUnitStatus,
  confirmedUnitOrigins,
  receiptFields,
  reconciliation,
  type RealCash,
  type RealField,
  type RealUnit,
} from "./real-data";
import { Back, Badge, Icon, Note, PeriodSelect, RowLink } from "./ui";

const value = (cents: number | null) =>
  cents === null ? "A conferir" : money(cents / 100);
const cashLink = (r: RealCash) => `/caixa/historico/${r.id}`;
export function SourceNote() {
  return (
    <details className="panel">
      <summary>Como este número foi formado</summary>
      <Note>
        <b>Histórico real · transcrição inicial.</b> Livro de fechamento de 01 a
        31/07/2026, páginas 132–162. Os valores legíveis foram preservados e
        ainda precisam de conferência com Higor. Campos duvidosos ficam sem
        valor; exemplos não completam este histórico.
      </Note>
    </details>
  );
}
function TotalRow({ field, label }: { field: RealField; label: string }) {
  const t = realTotal(field);
  return (
    <RowLink
      to={`/indicadores/faturamento/${field}`}
      title={label}
      subtitle={`${t.count} de 31 dias transcritos${t.count < 31 ? " · subtotal parcial" : ""}`}
      value={value(t.cents)}
    />
  );
}
export function RealDashboard() {
  const sales = realTotal("vendas");
  const diff = realTotal("diferenca");
  const [chartParams, setChartParams] = useSearchParams();
  const selectedDay = realCash.find((r) => r.id === chartParams.get("dia"));
  const setSelectedDay = (r: RealCash) => {
    const next = new URLSearchParams(chartParams);
    next.set("dia", r.id);
    setChartParams(next, { replace: true });
  };
  const max = Math.max(...realCash.map((r) => r.values.vendas ?? 0));
  return (
    <>
      <h1 className="sr-only">Visão geral</h1>
      <PeriodSelect />
      <div className="period-caption">
        <span>Histórico real · julho</span>
        <Link to="/mais#qualidade">Fontes e cobertura ↗</Link>
      </div>
      <Link className="hero metric-link" to="/indicadores/faturamento">
        <div className="row">
          <span className="eyebrow">TOTAL DE VENDAS NO LIVRO</span>
          <Icon name="arrow" />
        </div>
        <strong className="hero-value">{value(sales.cents)}</strong>
        <div className="row">
          <span className="growth">31 dias com total transcrito</span>
          <Badge kind="calculado" />
        </div>
        <div className="hero-bottom">
          <span>
            Média dos dias transcritos{" "}
            <b>{money(sales.cents / sales.count / 100)}</b>
          </span>
          <span>Ver cada dia ↗</span>
        </div>
      </Link>
      <div className="analysis-grid">
        <section className="panel">
          <span className="eyebrow">ORIGENS MAPEADAS · COBERTURA PARCIAL</span>
          <h2>Vendas por unidade</h2>
          <p>
            Subtotais com coberturas distintas; não formam um mix completo.
            Toque para conferir cada dia.
          </p>
          {units.map((recognized) => {
            const u = confirmedUnitOrigins.find(
              (item) => item.id === recognized.id,
            );
            if (!u)
              return (
                <div className="summary-row" key={recognized.id}>
                  <span>{recognized.name}</span>
                  <span>Sem dados identificados neste período</span>
                </div>
              );
            const total = realUnitTotal(u.id);
            return (
              <RowLink
                key={u.id}
                to={`/indicadores/faturamento/${u.id}`}
                title={u.name}
                subtitle={`No livro: ${u.original} · ${total.count}/31 dias com valor transcrito`}
                value={value(total.cents)}
              />
            );
          })}
        </section>
        <section className="panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">31 DIAS · JULHO 2026</span>
              <h2>O movimento real do mês</h2>
            </div>
            <Badge kind="calculado" />
          </div>
          <p className="muted">Total de vendas escrito em cada fechamento.</p>
          <div
            className="daily-chart"
            role="group"
            aria-label={realCash
              .map((r) => `${dateLabel(r.date)}: ${value(r.values.vendas)}`)
              .join("; ")}
          >
            {realCash.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => setSelectedDay(r)}
                title={`${dateLabel(r.date)} · ${value(r.values.vendas)}`}
                aria-label={`${dateLabel(r.date)} · ${value(r.values.vendas)}`}
                style={{ height: `${((r.values.vendas ?? 0) / max) * 100}%` }}
              >
                <span className="chart-day" aria-hidden="true">
                  {r.date.slice(-2)}
                </span>
              </button>
            ))}
          </div>
          {selectedDay ? (
            <div className="chart-selection" aria-live="polite">
              <b>
                {dateLabel(selectedDay.date)} ·{" "}
                {value(selectedDay.values.vendas)}
              </b>
              <RowLink to={cashLink(selectedDay)} title="Abrir fechamento" />
            </div>
          ) : null}
          <div className="chart-axis">
            <span>Deslize para percorrer os 31 dias →</span>
          </div>
          <p className="chart-note">
            Toque em uma barra para conferir o dia e acessar a foto original.
            Sem comparação mensal: os outros meses ainda não têm fonte real.
          </p>
        </section>
      </div>
      <details className="panel">
        <summary>Caixa e conferência · diferenças e recebimentos</summary>
        <div className="panel compact">
          <TotalRow field="registrado" label="Total registrado no livro" />
          <TotalRow field="saidas" label="Saídas anotadas no caixa" />
        </div>
        <Link
          className="panel metric-link cash-attention"
          to="/indicadores/faturamento/diferenca"
        >
          <div className="row">
            <span className="eyebrow">DIFERENÇAS ANOTADAS</span>
            <Badge kind="calculado" />
          </div>
          <div className="row">
            <strong>{value(diff.cents)}</strong>
            <Icon name="arrow" />
          </div>
          <span>
            Soma dos saldos positivos e negativos · não representa lucro
          </span>
        </Link>
        <section className="panel">
          <span className="eyebrow">RECEBIMENTOS · COBERTURA PARCIAL</span>
          <h2>Como o caixa recebeu</h2>
          <p className="muted">
            Valores por forma de recebimento. O dia 29 aguarda uma foto mais
            nítida.
          </p>
          {receiptFields.map(([id, label]) => (
            <TotalRow key={id} field={id} label={label} />
          ))}
        </section>
      </details>
      <details className="panel">
        <summary>Indicadores sem fonte · o que falta</summary>
        {[
          [
            "cmv",
            "Compras / CMV",
            "Compras e estoques ainda sem fonte consolidada.",
          ],
          [
            "despesas",
            "Despesas gerais",
            "As saídas do caixa ainda não têm classificação gerencial.",
          ],
          ["pessoal", "Pessoal", "Sem folha ou total geral confirmado."],
          [
            "resultado",
            "Resultado gerencial",
            "Depende de CMV, despesas e pessoal com cobertura suficiente.",
          ],
          [
            "prime-cost",
            "CMV + Pessoal",
            "Depende de CMV e pessoal; não calculado com lacunas.",
          ],
        ].map(([id, name, reason]) => (
          <RowLink
            key={id}
            to={`/indicadores/${id}`}
            title={name}
            subtitle={reason}
            value="—"
          />
        ))}
      </details>

      <section className="panel cash-teaser">
        <h2>O caixa, dia a dia</h2>
        <p>Consulte os 31 fechamentos reais com sua origem.</p>
        <Link className="primary" to="/caixa">
          Ver histórico do caixa <Icon name="arrow" size={16} />
        </Link>
      </section>
    </>
  );
}
export function RealIndicator() {
  const { tipo = "", grupo } = useParams();
  const unit = confirmedUnitOrigins.find((u) => u.id === grupo);
  if (tipo === "faturamento" && unit)
    return <RealUnitIndicator unit={unit.id} />;
  const names: Partial<Record<RealField, string>> = {
    vendas: "Total de vendas no livro",
    registrado: "Total registrado no livro",
    saidas: "Saídas anotadas no caixa",
    diferenca: "Diferenças anotadas",
    ...Object.fromEntries(receiptFields),
  };
  if (tipo !== "faturamento") {
    const name =
      tipo === "resultado"
        ? "Resultado gerencial"
        : tipo === "prime-cost"
          ? "CMV + Pessoal"
          : (metricNames[tipo as Metric] ?? "Indicador indisponível");
    return (
      <>
        <Back to="/">Visão geral</Back>
        <h1>{name}</h1>
        <section className="empty panel">
          <Icon name="document" size={30} />
          <h2>Fonte real ainda incompleta</h2>
          <p>
            O livro do caixa permite consultar vendas, recebimentos e saídas.
            Para este indicador, falta consolidar as fontes e validar a
            classificação com Higor. Não usamos exemplos para completar números
            reais.
          </p>
          <Link className="primary" to="/indicadores/faturamento">
            Consultar os dados disponíveis
          </Link>
        </section>
      </>
    );
  }
  const field = (grupo || "vendas") as RealField;
  if (!names[field])
    return (
      <>
        <Back to="/indicadores/faturamento">Vendas no livro</Back>
        <h1>Unidade ainda sem correspondência</h1>
        <Note>
          A relação entre as descrições do livro e as unidades atuais precisa
          ser confirmada com Higor.
        </Note>
      </>
    );
  const total = realTotal(field);
  return (
    <>
      <Back to={grupo ? "/indicadores/faturamento" : "/"}>
        {grupo ? "Vendas no livro" : "Visão geral"}
      </Back>
      <h1>{names[field]}</h1>
      <PeriodSelect />
      <section className="detail-hero">
        <span className="eyebrow">
          {names[field]} · JULHO 2026 · {total.count}/31 DIAS
        </span>
        <strong>{value(total.cents)}</strong>
        <Badge kind="calculado" />
        <span>
          {total.count === 31
            ? "Soma dos valores transcritos"
            : "Subtotal parcial · dias pendentes não são zero"}
        </span>
      </section>
      <SourceNote />
      {field === "vendas" ? (
        <Note>
          O livro distingue “total de vendas” e “total registrado”. Preservamos
          os dois campos; Higor confirmará qual é a referência de faturamento
          gerencial.
        </Note>
      ) : field === "saidas" ? (
        <Note>
          Saídas do caixa não equivalem automaticamente a despesas gerais,
          compras ou pessoal. A classificação está pendente.
        </Note>
      ) : field === "diferenca" ? (
        <Note>
          Soma dos valores escritos na linha “diferença”. Não é resultado
          gerencial nem lucro.
        </Note>
      ) : null}
      <h2>Fechamentos que compõem o número</h2>
      <div className="panel compact">
        <DayRows field={field} />
      </div>
      <p className="hint">
        Abra o dia para ver os valores anotados, conferir as somas e acessar a
        foto original.
      </p>
    </>
  );
}
function RealUnitIndicator({ unit }: { unit: RealUnit }) {
  const mapping = confirmedUnitOrigins.find((u) => u.id === unit)!;
  const total = realUnitTotal(unit);
  return (
    <>
      <Back to="/">Visão geral</Back>
      <h1>{mapping.name}</h1>
      <PeriodSelect />
      <section className="detail-hero">
        <span className="eyebrow">
          {mapping.name} · JULHO 2026 · {total.count}/31 DIAS
        </span>
        <strong>{value(total.cents)}</strong>
        <Badge kind="calculado" />
        <span>
          Subtotal dos valores legíveis · no livro: {mapping.original}
        </span>
      </section>
      <details className="panel">
        <summary>Como este número foi formado</summary>
        <Note>
          <b>
            {mapping.original} → {mapping.name}.
          </b>{" "}
          Correspondência confirmada pelo usuário. O nome original permanece na
          fonte. A soma usa somente os dias com valor transcrito; campos em
          branco ou desfocados ficam sem valor, sem completar com exemplos.
        </Note>
      </details>
      <h2>Valores anotados por dia</h2>
      <div className="panel compact">
        <DayRows unit={unit} />
      </div>
      <p className="hint">
        Abra o dia para conferir os recebimentos, as origens e a foto original.
      </p>
    </>
  );
}
export function RealHistoryList() {
  return (
    <>
      <h2>Histórico real · julho 2026</h2>
      <p>31 páginas do livro. Transcrição inicial, a conferir.</p>
      <div className="panel compact">
        <DayRows reverse />
      </div>
    </>
  );
}
export function RealCashDetail({ id }: { id: string }) {
  const location = useLocation();
  const origin = location.state?.returnTo as string | undefined;
  const originName = location.state?.returnName as string | undefined;
  const record = realCash.find((r) => r.id === id);
  if (!record)
    return (
      <>
        <Back to={origin || "/caixa"}>
          {originName || "Histórico do caixa"}
        </Back>
        <h1>Registro indisponível</h1>
      </>
    );
  const c = reconciliation(record);
  return (
    <>
      <Back to={origin || "/caixa"}>{originName || "Histórico do caixa"}</Back>
      <span className="eyebrow">LIVRO REAL · PÁGINA {record.page}</span>
      <h1>Fechamento · {dateLabel(record.date)}</h1>
      <section className="detail-hero">
        <span className="eyebrow">TOTAL DE VENDAS ANOTADO</span>
        <strong>{value(record.values.vendas)}</strong>
        <Badge kind="observado" example={false} />
        <span>Transcrito da foto · a conferir com Higor</span>
      </section>
      {record.note ? (
        <Note tone="warning">
          <b>Pendência na fonte.</b> {record.note}
        </Note>
      ) : null}
      <section className="panel">
        <h2>Recebimentos anotados</h2>
        {receiptFields.map(([field, label]) => (
          <div className="summary-row" key={field}>
            <span>{label}</span>
            <b>{value(record.values[field])}</b>
          </div>
        ))}
        <div className="summary-row total-row">
          <span>
            Soma dos recebimentos <Badge kind="calculado" />
          </span>
          <b>{value(c.receipts)}</b>
        </div>
      </section>
      <section className="panel">
        <h2>Os campos do livro</h2>
        {(
          [
            ["saidas", "Despesas / saídas anotadas"],
            ["vendas", "Total de vendas"],
            ["registrado", "Total registrado"],
            ["diferenca", "Diferença anotada"],
          ] as const
        ).map(([field, label]) => (
          <div className="summary-row" key={field}>
            <span>{label}</span>
            <b>{value(record.values[field])}</b>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>Conferência da transcrição</h2>
        <p>
          Comparações aritméticas para ajudar a conferir a foto. Os valores do
          livro permanecem como foram escritos.
        </p>
        <div className="summary-row">
          <span>Vendas − registrado</span>
          <b>{value(c.difference)}</b>
        </div>
        <div className="summary-row">
          <span>Recebimentos + saídas − vendas</span>
          <b>{value(c.compositionGap)}</b>
        </div>
        <p className="hint">
          A fórmula operacional e os conceitos de vendas, registrado e saídas
          ainda precisam de validação com Higor.
        </p>
      </section>
      <section className="panel">
        <h2>Vendas por unidade · origens confirmadas</h2>
        {confirmedUnitOrigins.map((u) => (
          <div className="summary-row" key={u.id}>
            <span>
              {u.name}
              <small className="origin-label">No livro: {u.original}</small>
            </span>
            <b>
              {record.unitValues[u.id] === null
                ? realUnitStatus(record, u.id)
                : value(record.unitValues[u.id])}
            </b>
          </div>
        ))}
        <p className="hint">
          Parte das origens do livro, sem rateio. Campos sem valor anotado ou
          sem leitura segura não representam zero.
        </p>
      </section>
      <section className="panel">
        <h2>Documento de origem</h2>
        <p>
          {record.file} · página {record.page} · julho 2026
        </p>
        <a
          className="primary"
          href={record.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Abrir foto original no Drive <Icon name="document" size={18} />
        </a>
        <p className="hint">
          O acesso depende da permissão do seu Google Drive. As fotos originais
          não foram copiadas para o site.
        </p>
      </section>
      <Note>
        As descrições detalhadas das saídas, os nomes da equipe e as demais
        origens ainda serão conferidos nas fontes. Almoço, Marmitex e Lojista já
        correspondem a Buffet, Marmita e Vitrine. Não criamos lançamentos
        fictícios neste registro.
      </Note>
    </>
  );
}

function DayRows({
  field = "vendas",
  unit,
  reverse = false,
}: {
  field?: RealField;
  unit?: RealUnit;
  reverse?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const query = params.get("data") || "";
  const pending = params.get("pendencias") === "1";
  const list = (reverse ? [...realCash].reverse() : realCash).filter((r) => {
    const missing = unit
      ? r.unitValues[unit] === null
      : r.values[field] === null;
    return (
      (!query || r.date.includes(query) || dateLabel(r.date).includes(query)) &&
      (!pending || missing || !!r.note)
    );
  });
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };
  return (
    <>
      <div className="day-filters">
        <label className="text-field">
          Buscar data
          <input
            type="search"
            value={query}
            placeholder="25/07 ou 2026-07-25"
            onChange={(e) => change("data", e.target.value)}
          />
        </label>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={pending}
            onChange={(e) => change("pendencias", e.target.checked ? "1" : "")}
          />{" "}
          Somente pendências
        </label>
      </div>
      <p className="hint">
        {list.length} de 31 dias · filtro não altera o subtotal do período
      </p>
      {list.map((r) => (
        <RowLink
          key={r.id}
          to={cashLink(r)}
          title={dateLabel(r.date)}
          subtitle={`Página ${r.page} · ${unit ? realUnitStatus(r, unit) : r.note || (r.values[field] === null ? "valor pendente" : "registro transcrito")}`}
          value={value(unit ? r.unitValues[unit] : r.values[field])}
        />
      ))}
      {!list.length && <p>Nenhum dia encontrado para este filtro.</p>}
    </>
  );
}
