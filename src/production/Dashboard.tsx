import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type {
  DashboardResponse,
  HistoricalCashRecord,
  SaleRevision,
  StoredSale,
} from "../../shared/contracts";
import { dateLabel, money, units } from "../domain";
import { monthLabel, previousMonth, type Period } from "../months";
import { paymentMethods } from "../unit-sales";
import { api, ApiError } from "./api";
import { useAuth } from "./auth";
import { ReceiptTable, SaleTotals } from "./Sales";
const currency = (v: number | null | undefined) =>
  v == null ? "Não informado" : money(v / 100);
function useMonth() {
  const { today } = useAuth();
  const [params, setParams] = useSearchParams();
  const raw = params.get("mes");
  const month =
    raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : today.slice(0, 7);
  return { month, today, params, setParams };
}
export function Dashboard() {
  const { month, today, params, setParams } = useMonth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    void api<DashboardResponse>(`/dashboard?month=${month}`, {
      signal: controller.signal,
    })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, retry]);
  const months: string[] = [];
  for (
    let value: Period = today.slice(0, 7) as Period, n = 0;
    n < 6;
    value = previousMonth(value), n++
  )
    months.unshift(value);
  function choose(value: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return;
    const next = new URLSearchParams(params);
    next.set("mes", value);
    next.delete("dia");
    setParams(next);
  }
  const rows =
    data?.source === "historical"
      ? data.historical.map((v) => ({
          date: v.date,
          total: v.values.vendas,
          complete: null,
          historical: v,
        }))
      : (data?.sales ?? []).map((v) => ({
          date: v.record.date,
          total: v.record.total,
          complete: v.record.completeCount ?? 0,
          historical: undefined,
        }));
  const known = rows.filter((r) => r.total !== null);
  const total = known.reduce((sum, row) => sum + (row.total ?? 0), 0);
  const netSales = data?.sales.filter((s) => s.record.partialNet != null) ?? [];
  const net = netSales.reduce((sum, s) => sum + s.record.partialNet!, 0);
  const fees = netSales.reduce((sum, s) => sum + s.record.partialFees!, 0);
  const netCoverage = netSales.reduce(
    (sum, s) => sum + (s.record.netCount ?? 0),
    0,
  );
  const completeNetDays = netSales.filter(
    (s) => s.record.netCount === 6,
  ).length;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const selectedDate =
    params.get("dia") ??
    [...sorted].reverse().find((r) => r.date < today)?.date ??
    sorted.at(-1)?.date;
  const selected = rows.find((r) => r.date === selectedDate);
  const max = Math.max(...rows.map((r) => r.total ?? 0), 1);
  return (
    <>
      <div className="p-page-title">
        <span className="eyebrow">VISÃO GERAL</span>
        <h1>Seu movimento, com clareza</h1>
        <p>Vendas e recebimentos registrados pela equipe.</p>
      </div>
      <section className="month-filter">
        <div className="p-section-title">
          <h2>{monthLabel(month)}</h2>
          <button onClick={() => choose(today.slice(0, 7))}>Mês atual</button>
        </div>
        <div className="p-month-grid" aria-label="Selecionar mês">
          {months.map((value) => (
            <button
              key={value}
              className={month === value ? "selected" : ""}
              aria-pressed={month === value}
              onClick={() => choose(value)}
            >
              <b>{monthLabel(value, true)}</b>
              <small>{value.slice(0, 4)}</small>
            </button>
          ))}
        </div>
        <label className="p-month-other">
          Outro mês
          <input
            type="month"
            value={month}
            max={today.slice(0, 7)}
            onChange={(e) => choose(e.target.value)}
          />
        </label>
        {month === today.slice(0, 7) && (
          <p className="p-muted">Mês em andamento · até {dateLabel(today)}</p>
        )}
      </section>
      {loading ? (
        <p role="status">Carregando os registros…</p>
      ) : error ? (
        <div className="p-panel">
          <p className="p-error" role="alert">
            {error}
          </p>
          <button onClick={() => setRetry((n) => n + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : !rows.length ? (
        <div className="p-panel">
          <h2>Ainda não há registros</h2>
          <p>
            Este mês não tem lançamentos confirmados. Dias sem registro
            continuam desconhecidos.
          </p>
          <Link className="p-primary" to={`/caixa/vendas?mes=${month}`}>
            Informar entradas
          </Link>
        </div>
      ) : (
        <>
          <p className="p-origin">
            <span className="p-badge">
              {data?.source === "historical"
                ? "Histórico importado"
                : "Registros da operação"}
            </span>{" "}
            {rows.length} dia(s) com registro
          </p>
          <div className="p-card-grid">
            <a className="p-stat" href="#movement">
              <span>
                {data?.source === "historical"
                  ? "Total de vendas anotado"
                  : `Vendas brutas ${rows.some((r) => r.complete !== null && r.complete < 6) ? "conhecidas" : "registradas"}`}
              </span>
              <strong>{currency(known.length ? total : null)}</strong>
              <small>
                Calculado · {known.length} dias com valor · ver dias ↓
              </small>
            </a>
            <a className="p-stat" href="#movement">
              <span>Média dos dias registrados</span>
              <strong>
                {currency(
                  known.length ? Math.round(total / known.length) : null,
                )}
              </strong>
              <small>Calculado · dias ausentes não entram na média</small>
            </a>
          </div>
          {data?.source === "operational" && (
            <section className="p-panel">
              <h2>Após as taxas</h2>
              <dl className="p-totals">
                <div>
                  <dt>Taxas conhecidas</dt>
                  <dd>{currency(netSales.length ? fees : null)}</dd>
                </div>
                <div>
                  <dt>Líquido conhecido</dt>
                  <dd>{currency(netSales.length ? net : null)}</dd>
                </div>
              </dl>
              <p className="p-muted">
                Calculado · {netCoverage}/{data.sales.length * 6} unidades nos
                dias registrados com líquido calculável; {completeNetDays}/
                {data.sales.length} dias completos. Os valores somam essa
                cobertura. Líquido após taxas não é lucro.
              </p>
            </section>
          )}
          <section id="movement" className="p-panel">
            <span className="eyebrow">MOVIMENTO DIÁRIO</span>
            <h2>Toque em um dia</h2>
            <p className="p-muted">
              Valores observados nos lançamentos; somas calculadas.{" "}
              {data?.source === "historical"
                ? "As lacunas do livro foram preservadas."
                : "Parciais mostram somente os valores conhecidos."}
            </p>
            <div className="p-daily-chart" aria-label="Vendas por dia">
              {sorted.map((row) => (
                <button
                  key={row.date}
                  aria-pressed={row.date === selectedDate}
                  aria-label={`${dateLabel(row.date)}: ${currency(row.total)}`}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("mes", month);
                    next.set("dia", row.date);
                    setParams(next);
                  }}
                >
                  <span
                    style={{
                      height: `${Math.max(3, ((row.total ?? 0) / max) * 90)}px`,
                    }}
                  />
                  <small>{row.date.slice(-2)}</small>
                </button>
              ))}
            </div>
            {selected && (
              <div className="p-day-preview">
                <div>
                  <b>{dateLabel(selected.date)}</b>
                  <strong>{currency(selected.total)}</strong>
                </div>
                <p>
                  {selected.complete === null
                    ? "Histórico importado · valores observados"
                    : `${selected.complete}/6 unidades completas`}
                </p>
                <Link
                  className="p-secondary"
                  to={`/dias/${selected.date}?mes=${month}`}
                >
                  Ver detalhes deste dia →
                </Link>
              </div>
            )}
          </section>
          {data?.source === "operational" && (
            <section className="p-panel">
              <h2>Vendas por unidade</h2>
              <p className="p-muted">
                Calculado a partir dos recebimentos informados. Unidades com
                lacunas exibem subtotal conhecido.
              </p>
              <div className="p-list">
                {units.map((u) => {
                  const records = data.sales.filter(
                    (s) => s.record.values[u.id] !== null,
                  );
                  const amount = records.reduce(
                    (sum, s) => sum + s.record.values[u.id]!,
                    0,
                  );
                  return (
                    <details key={u.id}>
                      <summary>
                        <span>
                          <b>{u.name}</b>
                          <small>
                            {records.length}/{data.sales.length} dias com
                            valores
                          </small>
                        </span>
                        <strong>
                          {currency(records.length ? amount : null)}
                        </strong>
                      </summary>
                      {data.sales.map((s) => (
                        <Link
                          className="p-list-row"
                          key={s.id}
                          to={`/dias/${s.record.date}?mes=${month}&unidade=${u.id}`}
                        >
                          <span>{dateLabel(s.record.date)}</span>
                          <b>{currency(s.record.values[u.id])} →</b>
                        </Link>
                      ))}
                    </details>
                  );
                })}
              </div>
            </section>
          )}
          {data?.source === "historical" && (
            <p className="p-notice">
              As origens do livro têm coberturas diferentes. Os recebimentos
              gerais não foram distribuídos entre unidades. CMV, despesas,
              pessoal e resultado sem fonte permanecem indisponíveis.
            </p>
          )}
        </>
      )}
    </>
  );
}
export function DayDetail() {
  const { date = "" } = useParams();
  const { month, params } = useMonth();
  const [sale, setSale] = useState<StoredSale | null>(null);
  const [historical, setHistorical] = useState<HistoricalCashRecord | null>(
    null,
  );
  const [revisions, setRevisions] = useState<SaleRevision[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setSale(null);
    setHistorical(null);
    setRevisions([]);
    void (async () => {
      try {
        if (date.startsWith("2026-07")) {
          const result = await api<DashboardResponse>(
            "/dashboard?month=2026-07",
          );
          if (active)
            setHistorical(
              result.historical.find((r) => r.date === date) ?? null,
            );
        } else {
          const result = await api<{ sale: StoredSale | null }>(
            `/sales/${date}`,
          );
          if (active) setSale(result.sale);
          if (result.sale) {
            const result = await api<{ revisions: SaleRevision[] }>(
              `/sales/${date}/revisions`,
            );
            if (active) setRevisions(result.revisions);
          }
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [date]);
  return (
    <>
      <Link className="p-back" to={`/?mes=${month}&dia=${date}`}>
        ← Visão geral
      </Link>
      <span className="eyebrow">DETALHE DO DIA</span>
      <h1>{dateLabel(date)}</h1>
      {loading ? (
        <p role="status">Carregando…</p>
      ) : error ? (
        <p role="alert" className="p-error">
          {error}
        </p>
      ) : historical ? (
        <HistoricalDetail row={historical} />
      ) : sale ? (
        <>
          <section className="p-panel">
            <span className="p-badge">Registros da operação</span>
            <p>Recebimentos observados · totais calculados.</p>
            <SaleTotals record={sale.record} />
            <p>{sale.record.completeCount ?? 0}/6 unidades completas.</p>
            <ReceiptTable
              record={sale.record}
              openUnit={params.get("unidade") ?? undefined}
            />
            <p className="p-muted">
              Taxas guardadas:{" "}
              {paymentMethods
                .filter((m) => m.id !== "dinheiro")
                .map(
                  (m) =>
                    `${m.name}: ${sale.record.rates?.[m.id as "debito" | "credito" | "pix"] == null ? "não informada" : `${sale.record.rates[m.id as "debito" | "credito" | "pix"]! / 100}%`}`,
                )
                .join(" · ")}
            </p>
            <Link
              className="p-primary"
              to={`/caixa/vendas?data=${date}&mes=${month}`}
            >
              Corrigir este lançamento
            </Link>
          </section>
          <section className="p-panel">
            <h2>Histórico de alterações</h2>
            {revisions.map((r) => (
              <details key={r.version}>
                <summary>
                  Versão {r.version} · {r.actor.name}
                </summary>
                <p>{new Date(r.createdAt).toLocaleString("pt-BR")}</p>
                <SaleTotals record={r.record} />
                <ReceiptTable record={r.record} />
              </details>
            ))}
          </section>
          <ChangeDate sale={sale} />
        </>
      ) : (
        <p>Não há lançamento nesta data.</p>
      )}
    </>
  );
}
function HistoricalDetail({ row }: { row: HistoricalCashRecord }) {
  const labels: Record<string, string> = {
    pix: "Pix",
    dinheiro: "Dinheiro",
    saidas: "Saídas",
    debito: "Débito",
    credito: "Crédito",
    voucher: "Voucher",
    ifood: "iFood",
    vendas: "Vendas anotadas",
    registrado: "Total registrado",
    diferenca: "Diferença anotada",
  };
  return (
    <>
      <section className="p-panel">
        <span className="p-badge">Histórico importado · observado</span>
        <h2>Livro de fechamento</h2>
        <dl className="p-totals">
          {Object.entries(row.values).map(([key, value]) => (
            <div key={key}>
              <dt>{labels[key] ?? key}</dt>
              <dd>{currency(value)}</dd>
            </div>
          ))}
        </dl>
        {row.note && <p className="p-notice">{row.note}</p>}
        <p>
          Página {row.page} · {row.file}
        </p>
        {/^https:\/\//.test(row.sourceUrl) && (
          <a
            className="p-secondary"
            href={row.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir documento original ↗
          </a>
        )}
        <p className="p-muted">
          Somente leitura durante o piloto. Campos sem valor não representam
          zero.
        </p>
      </section>
      <section className="p-panel">
        <h2>Origens identificadas</h2>
        <dl className="p-totals">
          {units.map((u) => (
            <div key={u.id}>
              <dt>
                {u.name}
                {row.unitPending[u.id] && (
                  <small>{row.unitPending[u.id]}</small>
                )}
              </dt>
              <dd>{currency(row.unitValues[u.id])}</dd>
            </div>
          ))}
        </dl>
        <p className="p-muted">
          Coberturas diferentes; não formam um mix completo. Nenhum recebimento
          geral foi rateado.
        </p>
      </section>
    </>
  );
}
function ChangeDate({ sale }: { sale: StoredSale }) {
  const { today } = useAuth();
  const [date, setDate] = useState(sale.record.date);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    date: string;
    expectedVersion: number;
    requestId: string;
  } | null>(null);
  return (
    <section className="p-panel">
      <details>
        <summary>Corrigir a data do lançamento</summary>
        <p>
          A correção ficará no histórico e não pode substituir outro dia
          existente.
        </p>
        <label>
          Nova data
          <input
            type="date"
            max={today}
            disabled={busy || pending !== null}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <button
          disabled={busy || date === sale.record.date || !date}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            const body = pending ?? {
              date,
              expectedVersion: sale.version,
              requestId: crypto.randomUUID(),
            };
            setPending(body);
            try {
              const result = await api<{ sale: StoredSale }>(
                `/sales/${sale.id}/date`,
                {
                  method: "PATCH",
                  body,
                },
              );
              const current = await api<{ sale: StoredSale | null }>(
                `/sales/${result.sale.record.date}`,
              );
              if (current.sale?.id !== result.sale.id) {
                setPending(null);
                setMessage(
                  "A alteração foi confirmada, mas o registro mudou novamente. Volte à Visão geral para consultar a versão atual.",
                );
                return;
              }
              setPending(null);
              window.location.assign(
                `/dias/${current.sale.record.date}?mes=${current.sale.record.date.slice(0, 7)}`,
              );
            } catch (e) {
              setMessage((e as Error).message);
              if (
                e instanceof ApiError &&
                e.status >= 400 &&
                e.status < 500 &&
                e.status !== 401
              )
                setPending(null);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy
            ? "Salvando…"
            : pending
              ? "Consultar alteração pendente"
              : "Salvar nova data"}
        </button>
        {message && (
          <p className="p-error" role="alert">
            {message}
          </p>
        )}
      </details>
    </section>
  );
}
