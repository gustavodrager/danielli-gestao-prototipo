import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import type {
  AppUser,
  SavedDraft,
  SalesPayload,
  StoredSale,
} from "../shared/contracts.ts";
import {
  emptyUnitSales,
  makeUnitSalesRecord,
  type UnitSalesDraft,
} from "../src/unit-sales.ts";
import { getPool, transaction } from "./db.ts";
import { authenticateInTransaction } from "./auth.ts";
import { ApiError, json, readJson, todayInSaoPaulo } from "./http.ts";

const unitIds = [
  "balcao",
  "buffet",
  "massas",
  "churrasco",
  "marmita",
  "vitrine",
] as const;
const methodIds = ["debito", "credito", "dinheiro", "pix"] as const;
const feeIds = ["debito", "credito", "pix"] as const;

// Technical safety limit: every multiplication by a rate and all 24 sums remain
// exact safe integers. It is not a sales target or an operational business rule.
export const MAX_RECEIPT_CENTS = 99_999_999_999;
const amountSchema = z.number().int().min(0).max(MAX_RECEIPT_CENTS).nullable();
const rateSchema = z.number().int().min(0).max(10_000).nullable();
const versionSchema = z.number().int().min(1).max(2_147_483_646).nullable();
const dateSchema = z.string().refine(isDate, "Informe uma data válida.");
const rawSchema = z.string().max(128);

const paymentsSchema = <T extends z.ZodType>(value: T) =>
  z.strictObject({
    balcao: z.strictObject({
      debito: value,
      credito: value,
      dinheiro: value,
      pix: value,
    }),
    buffet: z.strictObject({
      debito: value,
      credito: value,
      dinheiro: value,
      pix: value,
    }),
    massas: z.strictObject({
      debito: value,
      credito: value,
      dinheiro: value,
      pix: value,
    }),
    churrasco: z.strictObject({
      debito: value,
      credito: value,
      dinheiro: value,
      pix: value,
    }),
    marmita: z.strictObject({
      debito: value,
      credito: value,
      dinheiro: value,
      pix: value,
    }),
    vitrine: z.strictObject({
      debito: value,
      credito: value,
      dinheiro: value,
      pix: value,
    }),
  });
const valuesSchema = <T extends z.ZodType>(value: T) =>
  z.strictObject({
    balcao: value,
    buffet: value,
    massas: value,
    churrasco: value,
    marmita: value,
    vitrine: value,
  });

export const salesPayloadSchema = z.strictObject({
  date: dateSchema,
  receipts: paymentsSchema(amountSchema),
  rates: z.strictObject({
    debito: rateSchema,
    credito: rateSchema,
    pix: rateSchema,
  }),
  expectedVersion: versionSchema,
  requestId: z.uuid(),
});

export const salesDraftPayloadSchema = z.strictObject({
  draft: z.strictObject({
    date: dateSchema,
    values: valuesSchema(rawSchema),
    receipts: paymentsSchema(rawSchema).optional(),
    rates: z
      .strictObject({ debito: rawSchema, credito: rawSchema, pix: rawSchema })
      .optional(),
    legacyTotals: z
      .strictObject({
        values: valuesSchema(amountSchema),
        total: z
          .number()
          .int()
          .min(0)
          .max(MAX_RECEIPT_CENTS * 24),
        count: z.number().int().min(0).max(6),
      })
      .optional(),
  }),
  expectedVersion: versionSchema,
  baseVersion: versionSchema,
});

const changeDateSchema = z.strictObject({
  date: dateSchema,
  expectedVersion: versionSchema,
  requestId: z.uuid(),
});
type Context = { user: AppUser; sessionId: string };
type SaleRow = {
  id: string;
  date: string;
  creator_id: string;
  last_editor_id: string;
  version: number;
  record: StoredSale["record"];
  created_at: Date | string;
  updated_at: Date | string;
};
const columns =
  "id, to_char(date, 'YYYY-MM-DD') AS date, creator_id, last_editor_id, version, record, created_at, updated_at";
const instant = (date: Date | string) => new Date(date).toISOString();
const storedSale = (row: SaleRow): StoredSale => ({
  id: row.id,
  version: row.version,
  createdBy: row.creator_id,
  updatedBy: row.last_editor_id,
  createdAt: instant(row.created_at),
  updatedAt: instant(row.updated_at),
  record: row.record,
});

export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const time = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === value
  );
}
function requireDate(value: string): string {
  if (!isDate(value))
    throw new ApiError(400, "INVALID_DATE", "Informe uma data válida.");
  return value;
}
function requireMonth(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}$/.test(value) || !isDate(`${value}-01`)) {
    throw new ApiError(
      400,
      "INVALID_MONTH",
      "Informe o mês no formato AAAA-MM.",
    );
  }
  return value;
}
function requireManager(ctx: Context) {
  if (ctx.user.role !== "gestor")
    throw new ApiError(
      403,
      "MANAGER_REQUIRED",
      "Esta consulta é exclusiva do gestor.",
    );
}
function assertCanRead(ctx: Context, sale: StoredSale) {
  if (ctx.user.role !== "gestor" && ctx.user.id !== sale.createdBy) {
    throw new ApiError(
      403,
      "SALE_FORBIDDEN",
      "Você não tem acesso a este lançamento.",
    );
  }
}
export function assertDatePermission(
  user: AppUser,
  date: string,
  today = todayInSaoPaulo(),
): void {
  requireDate(date);
  if (date.startsWith("2026-07-"))
    throw new ApiError(
      409,
      "HISTORICAL_READ_ONLY",
      "Julho de 2026 é um histórico importado e somente leitura.",
    );
  if (date > today)
    throw new ApiError(
      400,
      "FUTURE_DATE",
      "Não é possível confirmar uma data futura.",
    );
  if (user.role !== "gestor" && date !== today) {
    throw new ApiError(
      403,
      "DATE_FORBIDDEN",
      "O operador pode confirmar e corrigir somente o dia atual. Solicite ao gestor a correção de outra data.",
    );
  }
}
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new ApiError(
      400,
      "INVALID_INPUT",
      "Confira os campos informados.",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  return result.data;
}
function decimal(value: number | null): string {
  return value === null
    ? ""
    : `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}
export function buildSaleRecord(
  payload: Pick<SalesPayload, "date" | "receipts" | "rates">,
): StoredSale["record"] {
  const draft = emptyUnitSales();
  draft.date = payload.date;
  for (const unit of unitIds)
    for (const method of methodIds)
      draft.receipts![unit][method] = decimal(payload.receipts[unit][method]);
  for (const method of feeIds)
    draft.rates![method] = decimal(payload.rates[method]);
  try {
    return makeUnitSalesRecord(draft);
  } catch {
    throw new ApiError(
      400,
      "INVALID_SALE",
      "Informe ao menos um recebimento válido. Campo vazio não representa zero.",
    );
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export const canonicalHash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
async function lock(client: PoolClient, key: string): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    key,
  ]);
}
async function replay(
  client: PoolClient,
  ctx: Context,
  requestId: string,
  hash: string,
): Promise<StoredSale | null> {
  const previous = await client.query<{
    actor_id: string;
    request_hash: string;
    snapshot: StoredSale;
  }>(
    "SELECT actor_id, request_hash, snapshot FROM sales_revisions WHERE request_id = $1",
    [requestId],
  );
  const row = previous.rows[0];
  if (!row) return null;
  if (row.actor_id !== ctx.user.id || row.request_hash !== hash) {
    throw new ApiError(
      409,
      "REQUEST_ID_REUSED",
      "Esta tentativa já foi utilizada com outros dados. Recarregue antes de confirmar novamente.",
    );
  }
  assertCanRead(ctx, row.snapshot);
  return row.snapshot;
}
async function saveRevision(
  client: PoolClient,
  sale: StoredSale,
  ctx: Context,
  requestId: string,
  hash: string,
) {
  await client.query(
    "INSERT INTO sales_revisions(day_id, version, actor_id, request_id, request_hash, snapshot) VALUES ($1, $2, $3, $4, $5, $6)",
    [sale.id, sale.version, ctx.user.id, requestId, hash, sale],
  );
}
async function saveReceipts(client: PoolClient, sale: StoredSale) {
  const values: unknown[] = [];
  const rows = unitIds.flatMap((unit) =>
    methodIds.map((method) => {
      const offset = values.length;
      values.push(sale.id, unit, method, sale.record.receipts![unit][method]);
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    }),
  );
  await client.query(
    `INSERT INTO sales_receipts(day_id, unit_id, method, amount) VALUES ${rows.join(",")} ON CONFLICT (day_id, unit_id, method) DO UPDATE SET amount = EXCLUDED.amount`,
    values,
  );
}

async function saveSale(
  payload: SalesPayload,
  pathDate: string,
  ctx: Context,
): Promise<StoredSale> {
  if (payload.date !== pathDate)
    throw new ApiError(
      400,
      "DATE_MISMATCH",
      "A data do preenchimento deve ser a mesma do lançamento.",
    );
  const record = buildSaleRecord(payload);
  const hash = canonicalHash({
    operation: "PUT /api/sales/:date",
    pathDate,
    payload,
  });
  return transaction(async (client) => {
    ctx = await authenticateInTransaction(client, ctx);
    // The request lock also serializes simultaneous retries on different days.
    await lock(client, `request:${payload.requestId}`);
    const previous = await replay(client, ctx, payload.requestId, hash);
    if (previous) return previous;
    // Repeating a completed request is a permitted read of the original result,
    // including after midnight. Only new writes need today's operator privilege.
    assertDatePermission(ctx.user, pathDate);
    await lock(client, `sale-date:${pathDate}`);
    const current = await client.query<SaleRow>(
      `SELECT ${columns} FROM sales_days WHERE date = $1::date FOR UPDATE`,
      [pathDate],
    );
    const row = current.rows[0];
    if (row) {
      const sale = storedSale(row);
      assertCanRead(ctx, sale);
      if (payload.expectedVersion !== sale.version)
        throw new ApiError(
          409,
          "SALE_CONFLICT",
          "Este dia já foi atualizado. Seu preenchimento foi mantido; consulte a versão atual antes de corrigir.",
          { currentVersion: sale.version },
        );
    } else if (payload.expectedVersion !== null) {
      throw new ApiError(
        409,
        "SALE_CONFLICT",
        "O lançamento mudou de data ou não está mais disponível nesta data. Atualize o histórico.",
      );
    }
    const result = row
      ? await client.query<SaleRow>(
          `UPDATE sales_days SET record = $1, version = version + 1, last_editor_id = $2, updated_at = now() WHERE id = $3 RETURNING ${columns}`,
          [record, ctx.user.id, row.id],
        )
      : await client.query<SaleRow>(
          `INSERT INTO sales_days(date, creator_id, last_editor_id, version, record) VALUES ($1::date, $2, $2, 1, $3) RETURNING ${columns}`,
          [pathDate, ctx.user.id, record],
        );
    const saved = storedSale(result.rows[0]);
    await saveReceipts(client, saved);
    await saveRevision(client, saved, ctx, payload.requestId, hash);
    if (pathDate === todayInSaoPaulo()) {
      await client.query(
        "UPDATE users SET default_rates = $1, updated_at = now() WHERE id = $2",
        [payload.rates, ctx.user.id],
      );
    }
    return saved;
  });
}

async function changeDate(
  id: string,
  body: unknown,
  ctx: Context,
): Promise<StoredSale> {
  requireManager(ctx);
  const payload = parse(changeDateSchema, body);
  if (payload.expectedVersion === null)
    throw new ApiError(
      400,
      "VERSION_REQUIRED",
      "Informe a versão do lançamento para corrigir a data.",
    );
  assertDatePermission(ctx.user, payload.date);
  const hash = canonicalHash({
    operation: "PATCH /api/sales/:id/date",
    id,
    payload,
  });
  return transaction(async (client) => {
    ctx = await authenticateInTransaction(client, ctx);
    requireManager(ctx);
    assertDatePermission(ctx.user, payload.date);
    await lock(client, `request:${payload.requestId}`);
    const previous = await replay(client, ctx, payload.requestId, hash);
    if (previous) return previous;
    const initial = (
      await client.query<SaleRow>(
        `SELECT ${columns} FROM sales_days WHERE id = $1`,
        [id],
      )
    ).rows[0];
    if (!initial)
      throw new ApiError(404, "SALE_NOT_FOUND", "Lançamento não encontrado.");
    for (const date of [...new Set([initial.date, payload.date])].sort())
      await lock(client, `sale-date:${date}`);
    const current = (
      await client.query<SaleRow>(
        `SELECT ${columns} FROM sales_days WHERE id = $1 FOR UPDATE`,
        [id],
      )
    ).rows[0];
    if (
      current.version !== payload.expectedVersion ||
      current.date !== initial.date
    )
      throw new ApiError(
        409,
        "SALE_CONFLICT",
        "Este lançamento foi atualizado. Recarregue antes de corrigir a data.",
        { currentVersion: current.version },
      );
    assertDatePermission(ctx.user, current.date);
    const target = await client.query(
      "SELECT id FROM sales_days WHERE date = $1::date AND id <> $2",
      [payload.date, id],
    );
    if (target.rows.length)
      throw new ApiError(
        409,
        "DATE_ALREADY_EXISTS",
        "A data escolhida já possui um lançamento. Nenhum registro foi alterado.",
      );
    const record = { ...current.record, date: payload.date };
    const result = await client.query<SaleRow>(
      `UPDATE sales_days SET date = $1::date, record = $2, version = version + 1, last_editor_id = $3, updated_at = now() WHERE id = $4 RETURNING ${columns}`,
      [payload.date, record, ctx.user.id, id],
    );
    const saved = storedSale(result.rows[0]);
    await saveRevision(client, saved, ctx, payload.requestId, hash);
    return saved;
  });
}

async function listSales(month: string, ctx: Context): Promise<StoredSale[]> {
  const result = await getPool().query<SaleRow>(
    `SELECT ${columns} FROM sales_days WHERE date >= $1::date AND date < ($1::date + interval '1 month')${ctx.user.role === "gestor" ? "" : " AND creator_id = $2"} ORDER BY date DESC`,
    ctx.user.role === "gestor" ? [`${month}-01`] : [`${month}-01`, ctx.user.id],
  );
  return result.rows.map(storedSale);
}
async function historical(month: string): Promise<unknown[]> {
  const result = await getPool().query<{ payload: unknown }>(
    "SELECT payload FROM historical_cash_records WHERE date >= $1::date AND date < ($1::date + interval '1 month') ORDER BY date",
    [`${month}-01`],
  );
  return result.rows.map((row) => row.payload);
}
type DraftRow = {
  date: string;
  version: number;
  base_version: number | null;
  draft: UnitSalesDraft;
  updated_at: Date | string;
};
const draftColumns =
  "to_char(date, 'YYYY-MM-DD') AS date, version, base_version, draft, updated_at";
const savedDraft = (row: DraftRow): SavedDraft => ({
  date: row.date,
  version: row.version,
  baseVersion: row.base_version,
  draft: row.draft,
  updatedAt: instant(row.updated_at),
});
async function saveDraft(
  date: string,
  body: unknown,
  ctx: Context,
): Promise<SavedDraft> {
  const payload = parse(salesDraftPayloadSchema, body);
  if (payload.draft.date !== date)
    throw new ApiError(
      400,
      "DATE_MISMATCH",
      "A data do rascunho deve ser a mesma do preenchimento.",
    );
  return transaction(async (client) => {
    ctx = await authenticateInTransaction(client, ctx);
    await lock(client, `draft:${ctx.user.id}:${date}`);
    const result = await client.query<DraftRow>(
      `SELECT ${draftColumns} FROM sales_drafts WHERE user_id = $1 AND date = $2::date FOR UPDATE`,
      [ctx.user.id, date],
    );
    const current = result.rows[0];
    if ((current?.version ?? null) !== payload.expectedVersion)
      throw new ApiError(
        409,
        "DRAFT_CONFLICT",
        "Existe uma versão mais recente deste rascunho em outro aparelho. O preenchimento deste aparelho foi mantido.",
        { currentVersion: current?.version ?? null },
      );
    const saved = current
      ? await client.query<DraftRow>(
          `UPDATE sales_drafts SET draft = $1, base_version = $2, version = version + 1, updated_at = now() WHERE user_id = $3 AND date = $4::date RETURNING ${draftColumns}`,
          [payload.draft, payload.baseVersion, ctx.user.id, date],
        )
      : await client.query<DraftRow>(
          `INSERT INTO sales_drafts(user_id, date, draft, base_version) VALUES ($1, $2::date, $3, $4) RETURNING ${draftColumns}`,
          [ctx.user.id, date, payload.draft, payload.baseVersion],
        );
    return savedDraft(saved.rows[0]);
  });
}

/** Only called after authentication and CSRF checks in the central handler. */
export async function handleSales(
  req: Request,
  url: URL,
  ctx: Context,
): Promise<Response | null> {
  if (url.pathname === "/api/dashboard" && req.method === "GET") {
    requireManager(ctx);
    const month = requireMonth(url.searchParams.get("month"));
    if (month === "2026-07")
      return json({
        month,
        source: "historical",
        sales: [],
        historical: await historical(month),
      });
    return json({
      month,
      source: "operational",
      sales: await listSales(month, ctx),
      historical: [],
    });
  }
  if (url.pathname === "/api/history" && req.method === "GET") {
    requireManager(ctx);
    return json({
      historical: await historical(requireMonth(url.searchParams.get("month"))),
    });
  }
  const historyMatch = /^\/api\/history\/(\d{4}-\d{2}-\d{2})$/.exec(
    url.pathname,
  );
  if (historyMatch && req.method === "GET") {
    requireManager(ctx);
    const date = requireDate(historyMatch[1]);
    const result = await getPool().query<{ payload: unknown }>(
      "SELECT payload FROM historical_cash_records WHERE date = $1::date",
      [date],
    );
    return json({ historical: result.rows[0]?.payload ?? null });
  }
  if (url.pathname === "/api/sales" && req.method === "GET")
    return json({
      sales: await listSales(requireMonth(url.searchParams.get("month")), ctx),
    });
  if (url.pathname === "/api/sales-drafts" && req.method === "GET") {
    const month = requireMonth(url.searchParams.get("month"));
    const result = await getPool().query<DraftRow>(
      `SELECT ${draftColumns} FROM sales_drafts WHERE user_id = $1 AND date >= $2::date AND date < ($2::date + interval '1 month') ORDER BY date DESC`,
      [ctx.user.id, `${month}-01`],
    );
    return json({ drafts: result.rows.map(savedDraft) });
  }
  const dateChangeMatch = /^\/api\/sales\/([0-9a-f-]{36})\/date$/i.exec(
    url.pathname,
  );
  if (dateChangeMatch && req.method === "PATCH") {
    const id = parse(z.uuid(), dateChangeMatch[1]);
    return json({ sale: await changeDate(id, await readJson(req), ctx) });
  }
  const salesMatch = /^\/api\/sales\/(\d{4}-\d{2}-\d{2})(\/revisions)?$/.exec(
    url.pathname,
  );
  if (salesMatch) {
    const date = requireDate(salesMatch[1]);
    if (req.method === "PUT" && !salesMatch[2])
      return json({
        sale: await saveSale(
          parse(salesPayloadSchema, await readJson(req)),
          date,
          ctx,
        ),
      });
    if (req.method === "GET") {
      const result = await getPool().query<SaleRow>(
        `SELECT ${columns} FROM sales_days WHERE date = $1::date`,
        [date],
      );
      const sale = result.rows[0] ? storedSale(result.rows[0]) : null;
      if (sale) assertCanRead(ctx, sale);
      if (salesMatch[2]) {
        if (!sale)
          throw new ApiError(
            404,
            "SALE_NOT_FOUND",
            "Lançamento não encontrado.",
          );
        const revisions = await getPool().query<{
          version: number;
          actor_id: string;
          name: string;
          created_at: Date | string;
          snapshot: StoredSale;
        }>(
          "SELECT r.version, r.actor_id, u.name, r.created_at, r.snapshot FROM sales_revisions r JOIN users u ON u.id = r.actor_id WHERE day_id = $1 ORDER BY version DESC",
          [sale.id],
        );
        return json({
          revisions: revisions.rows.map((revision) => ({
            version: revision.version,
            actor: { id: revision.actor_id, name: revision.name },
            createdAt: instant(revision.created_at),
            record: revision.snapshot.record,
          })),
        });
      }
      return json({ sale });
    }
  }
  const draftMatch = /^\/api\/sales-drafts\/(\d{4}-\d{2}-\d{2})$/.exec(
    url.pathname,
  );
  if (draftMatch) {
    const date = requireDate(draftMatch[1]);
    if (req.method === "GET") {
      const result = await getPool().query<DraftRow>(
        `SELECT ${draftColumns} FROM sales_drafts WHERE user_id = $1 AND date = $2::date`,
        [ctx.user.id, date],
      );
      return json({
        draft: result.rows[0] ? savedDraft(result.rows[0]) : null,
      });
    }
    if (req.method === "PUT")
      return json({ draft: await saveDraft(date, await readJson(req), ctx) });
  }
  return null;
}
