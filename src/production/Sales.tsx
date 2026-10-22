import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { SavedDraft, StoredSale } from "../../shared/contracts";
import { units, money, dateLabel } from "../domain";
import {
  blankPayments,
  emptyUnitSales,
  feeMethods,
  paymentMethods,
  ratesToDraft,
  recordToDraft,
  unitSalesErrors,
  unitSalesSummary,
  type FeeId,
  type UnitId,
  type UnitSalesDraft,
} from "../unit-sales";
import { api, ApiError } from "./api";
import { useAuth } from "./auth";
import { listLocal, readLocal, writeLocal, type LocalEntry } from "./storage";
import { useDraftLock } from "./useDraftLock";
const currency = (value: number | null | undefined) =>
  value == null ? "Não informado" : money(value / 100);
function focusSalesElement(id: string) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start", behavior: "instant" });
    }),
  );
}
const rateLabel = (value: string | undefined) =>
  value?.trim() ? `${value}%` : "não informada";

export function Sales() {
  const { user, today } = useAuth();
  const [params, setParams] = useSearchParams();
  const date = params.get("data") ?? today;
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!params.has("data")) {
      const next = new URLSearchParams(params);
      next.set("data", today);
      setParams(next, { replace: true });
    }
  }, [params, today, setParams]);
  return (
    <>
      <div className="p-page-title">
        <span className="eyebrow">ENTRADAS</span>
        <h1>Vendas do dia</h1>
        <p>
          Informe o que cada unidade recebeu. Os totais são calculados
          automaticamente.
        </p>
      </div>
      <label className="p-date">
        Data do movimento
        <input
          id="unit-sales-date"
          aria-label="Data do movimento"
          type="date"
          max={today}
          value={date}
          disabled={user!.role === "operador"}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.set("data", e.target.value);
            setParams(next);
          }}
        />
      </label>
      {date !== today && user!.role === "operador" && (
        <Link className="p-secondary" to={`/caixa/vendas?data=${today}`}>
          Ir para as entradas de hoje →
        </Link>
      )}
      <SalesForm
        key={`${user!.id}:${date}`}
        date={date}
        onSaved={() => setRefresh((n) => n + 1)}
      />
      <SalesHistory refresh={refresh} />
    </>
  );
}
function SalesForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const { user, today, setDefaultRates } = useAuth();
  const lock = useDraftLock(user!.id, date);
  const readOnly = user!.role === "operador" && date !== today;
  const [copied, setCopied] = useState(false);
  const [entry, setEntry] = useState<LocalEntry | null>(null);
  const entryRef = useRef<LocalEntry | null>(null);
  const [sale, setSale] = useState<StoredSale | null>(null);
  const [remoteDraft, setRemoteDraft] = useState<SavedDraft | null>(null);
  const [unit, setUnit] = useState<UnitId>("balcao");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Rascunho neste aparelho");
  const [storageError, setStorageError] = useState("");
  const [stage, setStage] = useState<"form" | "review" | "confirmed">("form");
  const [busy, setBusy] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [errors, setErrors] = useState<{ field: string; message: string }[]>(
    [],
  );
  const [conflict, setConflict] = useState(false);
  const [compared, setCompared] = useState(false);
  const [revisions, setRevisions] = useState<
    | {
        version: number;
        createdAt: string;
        actor: { id: string; name: string };
        record: StoredSale["record"];
      }[]
    | null
  >(null);
  const alive = useRef(true);
  const draftSave = useRef(0);
  const savingDraft = useRef<Promise<unknown> | null>(null);
  const saveLocal = async (value: LocalEntry) => {
    try {
      if (!(await lock.assert()))
        throw new Error("A edição está aberta em outra aba.");
      await writeLocal(value, lock.leaseOwner, lock.isHeld);
      if (alive.current) setStorageError("");
      return true;
    } catch {
      if (alive.current)
        setStorageError(
          "Não foi possível salvar neste aparelho. Mantenha esta página aberta e tente novamente.",
        );
      return false;
    }
  };
  const replace = (value: LocalEntry) => {
    entryRef.current = value;
    setEntry(value);
    void saveLocal(value);
  };
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    void (async () => {
      let local: LocalEntry | null = null;
      try {
        local = await readLocal(user!.id, date);
      } catch {
        setStorageError(
          "A recuperação neste aparelho está indisponível. Mantenha a página aberta enquanto preenche.",
        );
      }
      let remoteDraft: SavedDraft | null = null;
      let remoteSale: StoredSale | null = null;
      const reads = await Promise.allSettled([
        api<{ draft: SavedDraft | null }>(`/sales-drafts/${date}`),
        api<{ sale: StoredSale | null }>(`/sales/${date}`),
      ]);
      if (reads[0].status === "fulfilled") remoteDraft = reads[0].value.draft;
      if (reads[1].status === "fulfilled") remoteSale = reads[1].value.sale;
      const failed = reads.find((result) => result.status === "rejected");
      if (!cancelled && failed?.status === "rejected")
        setMessage((failed.reason as Error).message);
      if (cancelled) return;
      const fresh: LocalEntry = {
        userId: user!.id,
        date,
        draft: { ...emptyUnitSales(ratesToDraft(user!.defaultRates)), date },
        baseVersion: null,
        serverVersion: remoteDraft?.version ?? null,
        updatedAt: new Date().toISOString(),
      };
      const usableRemoteDraft =
        remoteDraft &&
        (!remoteSale ||
          remoteDraft.baseVersion === remoteSale.version ||
          remoteDraft.updatedAt > remoteSale.updatedAt)
          ? remoteDraft
          : null;
      let initial = local;
      if (!initial && usableRemoteDraft)
        initial = {
          ...fresh,
          draft: usableRemoteDraft.draft,
          baseVersion: usableRemoteDraft.baseVersion,
          serverVersion: usableRemoteDraft.version,
          updatedAt: usableRemoteDraft.updatedAt,
        };
      if (!initial && remoteSale)
        initial = {
          ...fresh,
          draft: recordToDraft(remoteSale.record),
          baseVersion: remoteSale.version,
        };
      initial ??= fresh;
      setSale(remoteSale);
      entryRef.current = initial;
      setEntry(initial);
      if (
        remoteSale &&
        ((!local && !usableRemoteDraft) ||
          (initial.confirmed && initial.baseVersion === remoteSale.version))
      )
        setStage("confirmed");
      if (
        local &&
        !initial.pending &&
        remoteDraft &&
        local.serverVersion !== remoteDraft.version &&
        local.updatedAt !== remoteDraft.updatedAt
      ) {
        setConflict(true);
        setMessage(
          "Há outro rascunho salvo no sistema. Seu preenchimento local foi preservado. Consulte a versão atual antes de continuar.",
        );
      }
      if (
        remoteSale &&
        !initial.pending &&
        initial.baseVersion !== remoteSale.version &&
        (local || usableRemoteDraft)
      ) {
        setConflict(true);
        setMessage(
          "O lançamento mudou desde o início deste rascunho. Seu preenchimento foi preservado para conferência.",
        );
      }
      setStatus(
        local
          ? "Rascunho neste aparelho"
          : remoteDraft
            ? "Rascunho salvo no sistema"
            : "Rascunho neste aparelho",
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      alive.current = false;
    };
  }, [date, user!.id]);
  useEffect(() => {
    const online = () => setConnectionAttempt((value) => value + 1);
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);
  useEffect(() => {
    if (
      !entry ||
      loading ||
      stage === "confirmed" ||
      conflict ||
      entry.pending ||
      entry.syncPaused ||
      readOnly ||
      !lock.held ||
      busy
    )
      return;
    const serial = ++draftSave.current;
    const timer = window.setTimeout(() => {
      const previousSave = savingDraft.current;
      const task = (async () => {
        if (previousSave) await previousSave.catch(() => {});
        if (
          !alive.current ||
          serial !== draftSave.current ||
          entryRef.current?.pending ||
          entryRef.current?.confirmed
        )
          return;
        setStatus("Salvando rascunho…");
        const snapshot = entryRef.current!;
        try {
          const { draft } = await api<{ draft: SavedDraft }>(
            `/sales-drafts/${date}`,
            {
              method: "PUT",
              body: {
                draft: snapshot.draft,
                expectedVersion: snapshot.serverVersion,
                baseVersion: snapshot.baseVersion,
              },
            },
          );
          if (!alive.current) return;
          const latest = entryRef.current;
          if (latest && !latest.confirmed) {
            const updated = { ...latest, serverVersion: draft.version };
            entryRef.current = updated;
            void saveLocal(updated);
            if (serial === draftSave.current) {
              setEntry(updated);
              setStatus("Rascunho salvo no sistema");
            }
          }
        } catch (e) {
          if (!alive.current) return;
          setStatus("Rascunho neste aparelho");
          if (e instanceof ApiError && e.status === 409) {
            setConflict(true);
            setMessage(
              "O rascunho foi alterado em outro aparelho. Seu preenchimento está preservado neste aparelho.",
            );
          } else setMessage((e as Error).message);
        }
      })();
      savingDraft.current = task;
    }, 800);
    return () => window.clearTimeout(timer);
    // Acknowledging the server version does not queue another save.
  }, [
    entry?.updatedAt,
    entry?.pending,
    entry?.syncPaused,
    loading,
    stage,
    conflict,
    busy,
    connectionAttempt,
    lock.held,
    readOnly,
  ]);
  if (loading || !entry)
    return <p role="status">Recuperando lançamento e rascunho…</p>;
  const summary = unitSalesSummary(entry.draft);
  const selected = units.find((u) => u.id === unit)!;
  const selectedSummary = summary.unitSummaries.find((u) => u.id === unit)!;
  const frozen = busy || !!entry.pending || conflict || readOnly || !lock.held;
  function editDraft(change: (draft: UnitSalesDraft) => UnitSalesDraft) {
    if (frozen) return;
    const current = entryRef.current!;
    const next = {
      ...current,
      draft: change(current.draft),
      updatedAt: new Date().toISOString(),
      pending: undefined,
      confirmed: false,
      syncPaused: false,
    };
    replace(next);
    setStatus("Rascunho neste aparelho");
    setErrors([]);
    setMessage("");
  }
  function review() {
    const issues = unitSalesErrors(entry!.draft);
    setErrors(issues);
    if (issues.length) {
      const first = issues[0].field;
      const found = units.find((u) => first.includes(`-${u.id}-`));
      if (found) setUnit(found.id);
      focusSalesElement(first);
    } else {
      setStage("review");
      focusSalesElement("sales-review-title");
    }
  }
  async function confirm() {
    setBusy(true);
    setMessage("");
    if (!(await lock.assert())) {
      setMessage(
        "A edição está aberta em outra aba. Feche-a e tente novamente.",
      );
      setBusy(false);
      return;
    }
    if (readOnly && !entryRef.current?.pending) {
      setMessage(
        "Esta data está disponível somente para consulta. Entregue o resumo ao gestor.",
      );
      setBusy(false);
      return;
    }
    ++draftSave.current;
    if (savingDraft.current) await savingDraft.current.catch(() => {});
    const current = entryRef.current!;
    const currentSummary = unitSalesSummary(current.draft);
    const pending = current.pending ?? {
      requestId: crypto.randomUUID(),
      body: null,
    };
    const body = current.pending?.body ?? {
      date,
      receipts: currentSummary.receipts,
      rates: currentSummary.rates,
      expectedVersion: current.baseVersion,
      requestId: pending.requestId,
    };
    const prepared = {
      ...current,
      pending: { requestId: pending.requestId, body },
    };
    replace(prepared);
    if (!(await saveLocal(prepared))) {
      setBusy(false);
      return;
    }
    try {
      const result = await api<{ sale: StoredSale }>(`/sales/${date}`, {
        method: "PUT",
        body,
      });
      let latest = result.sale;
      try {
        const refreshed = await api<{ sale: StoredSale | null }>(
          `/sales/${date}`,
        );
        latest = refreshed.sale ?? latest;
      } catch {
        /* The confirmed server response remains valid. */
      }
      const confirmed = {
        ...prepared,
        confirmed: true,
        pending: undefined,
        baseVersion: latest.version,
        draft: recordToDraft(latest.record),
        updatedAt: new Date().toISOString(),
      };
      replace(confirmed);
      setSale(latest);
      if (date === today && latest.record.rates)
        setDefaultRates(user!.id, latest.record.rates);
      setStage("confirmed");
      focusSalesElement("sales-confirmed-status");
      setStatus("Lançamento confirmado");
      onSaved();
    } catch (e) {
      setMessage((e as Error).message);
      focusSalesElement("sales-message");
      if (e instanceof ApiError && e.status === 409) {
        replace({ ...prepared, pending: undefined });
        setConflict(true);
        setCompared(false);
      } else if (
        e instanceof ApiError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 401
      ) {
        replace({ ...prepared, pending: undefined });
        setStage("form");
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function loadCurrent() {
    setBusy(true);
    try {
      const [recordResult, draftResult] = await Promise.all([
        api<{ sale: StoredSale | null }>(`/sales/${date}`),
        api<{ draft: SavedDraft | null }>(`/sales-drafts/${date}`),
      ]);
      setSale(recordResult.sale);
      setRevisions(null);
      setMessage(
        "Versão atual carregada abaixo. Compare com seu preenchimento antes de decidir.",
      );
      setRemoteDraft(draftResult.draft);
      setCompared(true);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function useCompared(source: "draft" | "confirmed" | "local") {
    const label =
      source === "draft"
        ? "o rascunho do sistema"
        : source === "confirmed"
          ? "o lançamento confirmado"
          : "os valores deste aparelho";
    const warning =
      source === "confirmed" && remoteDraft
        ? " Há também um rascunho no sistema; ele não será substituído agora."
        : "";
    if (
      !window.confirm(
        `Usar ${label} no formulário? As outras versões não serão mescladas.${warning} Revise antes de confirmar.`,
      )
    )
      return;
    const draft =
      source === "draft"
        ? remoteDraft?.draft
        : source === "confirmed"
          ? sale && recordToDraft(sale.record)
          : entry!.draft;
    if (!draft) return;
    replace({
      ...entry!,
      draft,
      baseVersion:
        source === "draft" ? remoteDraft!.baseVersion : (sale?.version ?? null),
      serverVersion: remoteDraft?.version ?? null,
      pending: undefined,
      confirmed: false,
      syncPaused: true,
      updatedAt: new Date().toISOString(),
    });
    setConflict(false);
    setCompared(false);
    setStage("form");
    setStatus(
      source === "draft"
        ? "Rascunho salvo no sistema"
        : "Rascunho neste aparelho",
    );
    setMessage(
      "Versão escolhida carregada. Revise os valores antes de confirmar. O rascunho do sistema será atualizado somente quando você editar um campo.",
    );
    focusSalesElement("sales-unit-title");
  }
  if (readOnly && !entry.pending)
    return (
      <section className="p-panel">
        <span className="p-badge">Somente consulta · {dateLabel(date)}</span>
        <h2>
          {entry.confirmed
            ? "Lançamento confirmado"
            : "Rascunho de data anterior"}
        </h2>
        <p>
          Operadores alteram somente o dia atual. Para registrar ou corrigir
          esta data, entregue o resumo ao gestor.
        </p>
        <SaleTotals record={summary} />
        <RawDraft draft={entry.draft} />
        <p className="p-muted">
          Taxas: débito {rateLabel(entry.draft.rates?.debito)}; crédito{" "}
          {rateLabel(entry.draft.rates?.credito)}; Pix{" "}
          {rateLabel(entry.draft.rates?.pix)}.
        </p>
        <button
          onClick={() => {
            const text = [
              `Danielli · ${dateLabel(date)} · ${entry.confirmed ? "Confirmado" : "Rascunho não confirmado"}`,
              "Valores em reais. Não informado significa desconhecido, não zero.",
              ...units.flatMap((u) => [
                u.name,
                ...paymentMethods.map(
                  (m) =>
                    `${m.name}: ${entry.draft.receipts?.[u.id]?.[m.id] || "Não informado"}`,
                ),
              ]),
              `Taxas: débito ${rateLabel(entry.draft.rates?.debito)}; crédito ${rateLabel(entry.draft.rates?.credito)}; Pix ${rateLabel(entry.draft.rates?.pix)}`,
            ].join("\n");
            void navigator.clipboard
              .writeText(text)
              .then(() => setCopied(true))
              .catch(() =>
                setMessage(
                  "Não foi possível copiar. Consulte os valores nesta tela com o gestor.",
                ),
              );
          }}
        >
          {copied ? "Resumo copiado" : "Copiar resumo para o gestor"}
        </button>
        {message && <p role="alert">{message}</p>}
      </section>
    );
  // See remote comparison below; never merge conflicting amounts automatically.
  if (stage === "confirmed" && sale && !conflict)
    return (
      <section id="sales-flow" className="p-panel">
        <span
          className="p-badge"
          id="sales-confirmed-status"
          tabIndex={-1}
          role="status"
        >
          Confirmado no sistema
        </span>
        <h2>{dateLabel(date)}</h2>
        <SaleTotals record={sale.record} />
        <p className="p-muted">
          Versão {sale.version} ·{" "}
          {new Date(sale.updatedAt).toLocaleString("pt-BR")}
        </p>
        <div className="p-actions">
          <button
            disabled={!lock.held}
            onClick={() => {
              replace({ ...entry, confirmed: false });
              setStage("form");
              focusSalesElement("sales-unit-title");
              setStatus("Rascunho neste aparelho");
            }}
          >
            Corrigir lançamento
          </button>
          <button
            onClick={() =>
              void api<{ revisions: NonNullable<typeof revisions> }>(
                `/sales/${date}/revisions`,
              )
                .then((v) => setRevisions(v.revisions))
                .catch((e) => setMessage(e.message))
            }
          >
            Histórico de alterações
          </button>
        </div>
        {message && (
          <p className="p-error" role="alert">
            {message}
          </p>
        )}
        {revisions && <RevisionList revisions={revisions} />}
      </section>
    );
  return (
    <section id="sales-flow" className="p-stack">
      {!lock.held && (
        <div className="p-notice" role="status">
          <b>
            {lock.checking
              ? "Protegendo o rascunho…"
              : "Edição disponível em uma aba por vez"}
          </b>
          <p>
            {lock.error ||
              "Se esta data estiver aberta em outra aba, feche aquela edição para continuar aqui. Os valores permanecem visíveis para consulta."}
          </p>
          <button disabled={lock.checking} onClick={lock.retry}>
            Tentar editar nesta aba
          </button>
        </div>
      )}
      <p className="p-save-state" role="status">
        {entry.pending
          ? "Confirmação pendente · tente novamente para obter a resposta"
          : status}
      </p>
      {status === "Rascunho neste aparelho" &&
        !entry.pending &&
        !conflict &&
        lock.held && (
          <button
            disabled={busy}
            onClick={() => {
              if (entry.syncPaused) replace({ ...entry, syncPaused: false });
              setConnectionAttempt((value) => value + 1);
            }}
          >
            Tentar salvar rascunho no sistema
          </button>
        )}
      {storageError && (
        <p role="alert" className="p-error">
          {storageError}
        </p>
      )}
      {message && (
        <p role="alert" className="p-notice" id="sales-message" tabIndex={-1}>
          {message}
        </p>
      )}
      {conflict && (
        <div className="p-panel">
          <h2>Conferir alterações</h2>
          <p>
            Seu preenchimento permanece abaixo. Não há mesclagem automática.
          </p>
          <button disabled={busy} onClick={() => void loadCurrent()}>
            Consultar versão atual
          </button>
          {sale && (
            <>
              <h3>Confirmado · versão {sale.version}</h3>
              <SaleTotals record={sale.record} />
              <ReceiptTable record={sale.record} />
            </>
          )}
          {remoteDraft && (
            <>
              <h3>Rascunho do sistema · versão {remoteDraft.version}</h3>
              <RawDraft draft={remoteDraft.draft} />
            </>
          )}
          {compared && (
            <div className="p-actions">
              {remoteDraft && (
                <button onClick={() => useCompared("draft")}>
                  Usar rascunho do sistema
                </button>
              )}
              {sale && (
                <button onClick={() => useCompared("confirmed")}>
                  Usar lançamento confirmado
                </button>
              )}
              <button onClick={() => useCompared("local")}>
                Continuar com meu preenchimento
              </button>
            </div>
          )}
        </div>
      )}
      {stage === "review" || entry.pending ? (
        <div className="p-panel">
          <span className="eyebrow">CONFERÊNCIA</span>
          <h2 id="sales-review-title" tabIndex={-1}>
            Confira antes de confirmar
          </h2>
          <p>
            {dateLabel(date)} · {summary.completeCount} de 6 unidades completas
            · {summary.receiptCount} de 24 recebimentos.
          </p>
          <div className="p-list">
            {units.map((u) => {
              const s = summary.unitSummaries.find((s) => s.id === u.id)!;
              return (
                <button
                  className="p-list-row"
                  disabled={frozen}
                  key={u.id}
                  onClick={() => {
                    setUnit(u.id);
                    setStage("form");
                    focusSalesElement("sales-unit-title");
                  }}
                >
                  <span>
                    <b>{u.name}</b>
                    <small>
                      {s.count}/4 recebimentos ·{" "}
                      {s.complete ? "Completa" : "Parcial"}
                    </small>
                  </span>
                  <span>
                    {currency(s.gross)}
                    <small>Corrigir →</small>
                  </span>
                </button>
              );
            })}
          </div>
          <SaleTotals record={summary} />
          <p className="p-muted">
            Taxas: débito {rateLabel(entry.draft.rates?.debito)}; crédito{" "}
            {rateLabel(entry.draft.rates?.credito)}; Pix{" "}
            {rateLabel(entry.draft.rates?.pix)}.
          </p>
          {summary.completeCount < 6 && (
            <p className="p-notice">
              Lançamento parcial. Campos vazios continuam desconhecidos. O
              líquido geral só fica disponível com cobertura completa.
            </p>
          )}
          <div className="p-actions">
            <button
              disabled={busy || conflict || !lock.held}
              className="p-primary"
              onClick={() => void confirm()}
            >
              {busy
                ? "Confirmando…"
                : entry.pending
                  ? readOnly
                    ? "Consultar confirmação pendente"
                    : "Tentar confirmar novamente"
                  : summary.completeCount === 6
                    ? "Confirmar lançamento"
                    : "Confirmar parcial"}
            </button>
            <button
              disabled={frozen}
              onClick={() => {
                setStage("form");
                focusSalesElement("sales-unit-title");
              }}
            >
              Voltar ao preenchimento
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="p-unit-tabs"
            role="tablist"
            aria-label="Unidades de negócio"
          >
            {units.map((u) => {
              const s = summary.unitSummaries.find((s) => s.id === u.id)!;
              return (
                <button
                  key={u.id}
                  role="tab"
                  aria-selected={unit === u.id}
                  aria-controls="unit-receipts"
                  id={`tab-${u.id}`}
                  onClick={() => setUnit(u.id)}
                >
                  <b>{u.name}</b>
                  <small>
                    {s.complete
                      ? "✓ Completa"
                      : s.count
                        ? `${s.count}/4 preenchidos`
                        : "A preencher"}
                  </small>
                </button>
              );
            })}
          </div>
          <div
            className="p-panel"
            id="unit-receipts"
            role="tabpanel"
            aria-labelledby={`tab-${unit}`}
          >
            <div className="p-section-title">
              <h2 id="sales-unit-title" tabIndex={-1}>
                {selected.name}
              </h2>
              <button
                disabled={frozen}
                onClick={() =>
                  editDraft((d) => ({
                    ...d,
                    receipts: {
                      ...d.receipts!,
                      [unit]: Object.fromEntries(
                        paymentMethods.map((m) => [m.id, "0,00"]),
                      ) as Record<
                        (typeof paymentMethods)[number]["id"],
                        string
                      >,
                    },
                  }))
                }
              >
                Sem movimento
              </button>
            </div>
            <fieldset disabled={frozen} className="p-input-grid">
              <legend className="sr-only">
                Recebimentos de {selected.name}
              </legend>
              {paymentMethods.map((method) => {
                const id = `unit-sales-${unit}-${method.id}`;
                const invalid = summary.invalidFields.some(
                  (f) => f.unit === unit && f.method === method.id,
                );
                return (
                  <label key={method.id} htmlFor={id}>
                    {method.name}
                    <span
                      className={`p-money-input ${invalid ? "invalid" : ""}`}
                    >
                      <span>R$</span>
                      <input
                        id={id}
                        inputMode="decimal"
                        placeholder="Ex.: 1.250,00"
                        value={entry.draft.receipts?.[unit]?.[method.id] ?? ""}
                        onChange={(e) =>
                          editDraft((d) => ({
                            ...d,
                            receipts: {
                              ...(d.receipts ?? blankPayments()),
                              [unit]: {
                                ...d.receipts![unit],
                                [method.id]: e.target.value,
                              },
                            },
                          }))
                        }
                        aria-invalid={invalid}
                        aria-describedby={invalid ? `${id}-error` : undefined}
                      />
                    </span>
                    {invalid && (
                      <small className="p-error" id={`${id}-error`}>
                        Use um valor de zero ou maior, com até duas casas
                        decimais.
                      </small>
                    )}
                  </label>
                );
              })}
            </fieldset>
            <dl className="p-totals">
              <div>
                <dt>Total bruto {selectedSummary.complete ? "" : "parcial"}</dt>
                <dd>{currency(selectedSummary.gross)}</dd>
              </div>
              <div>
                <dt>Taxas</dt>
                <dd>{currency(selectedSummary.fees)}</dd>
              </div>
              <div>
                <dt>Líquido após taxas</dt>
                <dd>{currency(selectedSummary.net)}</dd>
              </div>
            </dl>
            <button
              className="p-secondary"
              onClick={() => {
                setUnit(
                  units[
                    (units.findIndex((u) => u.id === unit) + 1) % units.length
                  ].id,
                );
                focusSalesElement("sales-unit-title");
              }}
            >
              Próxima unidade →
            </button>
          </div>
          <div className="p-panel">
            <h2>Taxas utilizadas</h2>
            <p>
              As mesmas taxas são aplicadas às seis unidades. Dinheiro não tem
              desconto.
            </p>
            <fieldset disabled={frozen} className="p-rate-grid">
              <legend className="sr-only">Taxas percentuais</legend>
              {feeMethods.map((method: FeeId) => (
                <label key={method} htmlFor={`fee-${method}`}>
                  {method === "debito"
                    ? "Débito"
                    : method === "credito"
                      ? "Crédito"
                      : "Pix"}
                  <span className="p-money-input">
                    <input
                      id={`fee-${method}`}
                      inputMode="decimal"
                      placeholder="Não informada"
                      value={entry.draft.rates?.[method] ?? ""}
                      aria-invalid={summary.invalidRates.includes(method)}
                      onChange={(e) =>
                        editDraft((d) => ({
                          ...d,
                          rates: { ...d.rates!, [method]: e.target.value },
                        }))
                      }
                    />
                    <span>%</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="p-muted">
              As taxas ficam guardadas com este lançamento. Mudanças futuras não
              alteram o passado.
            </p>
          </div>
          <div className="p-panel">
            <h2>Resumo geral</h2>
            <SaleTotals record={summary} />
            <p>
              {summary.receiptCount}/24 recebimentos · {summary.completeCount}/6
              unidades completas.
            </p>
            {errors.length > 0 && (
              <div className="p-error" role="alert">
                <b>Confira o preenchimento:</b>
                <ul>
                  {errors.map((e) => (
                    <li key={e.field}>{e.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <button className="p-primary" disabled={frozen} onClick={review}>
              Revisar lançamento
            </button>
          </div>
        </>
      )}
    </section>
  );
}
export function SaleTotals({
  record,
}: {
  record: Omit<
    Pick<
      StoredSale["record"],
      | "total"
      | "count"
      | "completeCount"
      | "netCount"
      | "feesTotal"
      | "netTotal"
      | "partialFees"
      | "partialNet"
    >,
    "total"
  > & { total: number | null };
}) {
  return (
    <dl className="p-totals">
      <div>
        <dt>Vendas brutas{record.completeCount !== 6 ? " · parcial" : ""}</dt>
        <dd>{currency(record.count ? record.total : null)}</dd>
      </div>
      <div>
        <dt>{record.netCount === 6 ? "Taxas" : "Taxas conhecidas"}</dt>
        <dd>{currency(record.feesTotal ?? record.partialFees)}</dd>
      </div>
      <div>
        <dt>
          {record.netCount === 6
            ? "Líquido após taxas"
            : "Líquido parcial conhecido"}
        </dt>
        <dd>{currency(record.netTotal ?? record.partialNet)}</dd>
      </div>
    </dl>
  );
}
export function ReceiptTable({
  record,
  openUnit,
}: {
  record: StoredSale["record"];
  openUnit?: string;
}) {
  return (
    <div className="p-list">
      {units.map((u) => (
        <details key={u.id} open={openUnit === u.id}>
          <summary>
            <b>{u.name}</b>
            <span>{currency(record.values[u.id])}</span>
          </summary>
          <dl className="p-totals">
            {paymentMethods.map((m) => (
              <div key={m.id}>
                <dt>{m.name}</dt>
                <dd>{currency(record.receipts?.[u.id]?.[m.id])}</dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
    </div>
  );
}
function RevisionList({
  revisions,
}: {
  revisions: {
    version: number;
    actor: { name: string };
    createdAt: string;
    record: StoredSale["record"];
  }[];
}) {
  return (
    <div className="p-list">
      <h3>Histórico de alterações</h3>
      {revisions.map((revision) => (
        <details key={revision.version}>
          <summary>
            Versão {revision.version} · {revision.actor.name}
          </summary>
          <p>{new Date(revision.createdAt).toLocaleString("pt-BR")}</p>
          <SaleTotals record={revision.record} />
          <ReceiptTable record={revision.record} />
        </details>
      ))}
    </div>
  );
}
function SalesHistory({ refresh }: { refresh: number }) {
  const { today, user } = useAuth();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [sales, setSales] = useState<StoredSale[]>([]);
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [locals, setLocals] = useState<LocalEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void Promise.allSettled([
      api<{ sales: StoredSale[] }>(`/sales?month=${month}`, {
        signal: controller.signal,
      }),
      api<{ drafts: SavedDraft[] }>(`/sales-drafts?month=${month}`, {
        signal: controller.signal,
      }),
      listLocal(user!.id, month),
    ]).then(([saleResult, draftResult, localResult]) => {
      if (controller.signal.aborted) return;
      if (saleResult.status === "fulfilled") setSales(saleResult.value.sales);
      else {
        setSales([]);
        if (saleResult.reason.name !== "AbortError")
          setError(saleResult.reason.message);
      }
      if (draftResult.status === "fulfilled")
        setDrafts(draftResult.value.drafts);
      else {
        setDrafts([]);
        if (draftResult.reason.name !== "AbortError")
          setError(draftResult.reason.message);
      }
      setLocals(localResult.status === "fulfilled" ? localResult.value : []);
      setLoading(false);
    });
    return () => controller.abort();
  }, [month, refresh, retry, user!.id]);
  const pendingByDate = new Map<
    string,
    { date: string; updatedAt: string; local: boolean; pending: boolean }
  >();
  const hasValues = (draft: UnitSalesDraft) =>
    units.some((u) =>
      paymentMethods.some((m) => (draft.receipts?.[u.id]?.[m.id] ?? "").trim()),
    );
  for (const draft of drafts) {
    const confirmed = sales.find((sale) => sale.record.date === draft.date);
    if (
      !hasValues(draft.draft) ||
      (confirmed &&
        draft.updatedAt <= confirmed.updatedAt &&
        draft.baseVersion !== confirmed.version)
    )
      continue;
    pendingByDate.set(draft.date, {
      date: draft.date,
      updatedAt: draft.updatedAt,
      local: false,
      pending: false,
    });
  }
  for (const draft of locals) {
    if (draft.confirmed || (!hasValues(draft.draft) && !draft.pending))
      continue;
    const existing = pendingByDate.get(draft.date);
    if (!existing || draft.updatedAt >= existing.updatedAt || draft.pending)
      pendingByDate.set(draft.date, {
        date: draft.date,
        updatedAt: draft.updatedAt,
        local: true,
        pending: !!draft.pending,
      });
  }
  const pending = [...pendingByDate.values()].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  return (
    <section className="p-panel">
      <div className="p-section-title">
        <h2>Histórico de entradas</h2>
        <button disabled={loading} onClick={() => setRetry((v) => v + 1)}>
          Atualizar
        </button>
      </div>
      <label>
        Mês
        <input
          type="month"
          value={month}
          max={today.slice(0, 7)}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      {loading ? (
        <p role="status">Carregando…</p>
      ) : (
        <>
          {error && (
            <p role="alert" className="p-error">
              {error}
            </p>
          )}
          <h3>Rascunhos não confirmados</h3>
          <p className="p-muted">
            Não entram nos indicadores. Somente seus próprios rascunhos são
            mostrados aqui.
          </p>
          {pending.length ? (
            <div className="p-list">
              {pending.map((draft) => (
                <Link
                  key={draft.date}
                  className="p-list-row"
                  to={`/caixa/vendas?data=${draft.date}&mes=${month}`}
                >
                  <span>
                    <b>{dateLabel(draft.date)}</b>
                    <small>
                      {draft.pending
                        ? "Confirmação pendente"
                        : draft.local
                          ? "Neste aparelho"
                          : "Salvo no sistema"}
                    </small>
                  </span>
                  <span>
                    {user!.role === "operador" && draft.date !== today
                      ? "Consultar →"
                      : "Retomar →"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="p-muted">
              Nenhum rascunho com recebimentos neste mês.
            </p>
          )}
          <h3>Lançamentos confirmados</h3>
          {!sales.length ? (
            <p className="p-muted">Nenhum lançamento neste mês.</p>
          ) : (
            <div className="p-list">
              {sales.map((sale) => (
                <details key={sale.id}>
                  <summary>
                    <span>
                      <b>{dateLabel(sale.record.date)}</b>
                      <small>
                        {sale.record.completeCount ?? 0}/6 unidades completas
                      </small>
                    </span>
                    <span>{currency(sale.record.total)}</span>
                  </summary>
                  <SaleTotals record={sale.record} />
                  <ReceiptTable record={sale.record} />
                  <Link
                    className="p-secondary"
                    to={`/caixa/vendas?data=${sale.record.date}&mes=${month}`}
                  >
                    {user!.role === "gestor" || sale.record.date === today
                      ? "Abrir para corrigir →"
                      : "Consultar lançamento →"}
                  </Link>
                </details>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RawDraft({ draft }: { draft: UnitSalesDraft }) {
  return (
    <div className="p-list">
      {units.map((u) => (
        <details key={u.id}>
          <summary>{u.name}</summary>
          <dl className="p-totals">
            {paymentMethods.map((m) => (
              <div key={m.id}>
                <dt>{m.name}</dt>
                <dd>{draft.receipts?.[u.id]?.[m.id] || "Não informado"}</dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
    </div>
  );
}
