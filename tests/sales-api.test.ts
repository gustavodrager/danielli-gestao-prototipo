import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { AppUser, SalesPayload, StoredSale } from "../shared/contracts.ts";
import { emptyUnitSales } from "../src/unit-sales.ts";
import { getPool } from "../server/db.ts";
import { ApiError, todayInSaoPaulo } from "../server/http.ts";
import { assertDatePermission, buildSaleRecord, canonicalHash, handleSales, isDate, MAX_RECEIPT_CENTS, salesDraftPayloadSchema, salesPayloadSchema } from "../server/sales.ts";
import { createTestDatabase } from "./db-helper.ts";

const unitIds = ["balcao", "buffet", "massas", "churrasco", "marmita", "vitrine"] as const;
const methods = ["debito", "credito", "dinheiro", "pix"] as const;
const user = (role: AppUser["role"] = "gestor"): AppUser => ({
  id: randomUUID(), login: `user.${randomUUID().slice(0, 8)}`, name: role,
  role, active: true, defaultRates: { debito: 300, credito: 400, pix: 100 },
});
function payload(date = "2026-10-22"): SalesPayload {
  const receipts = Object.fromEntries(unitIds.map((unit) => [unit, Object.fromEntries(methods.map((method) => [method, null]))])) as SalesPayload["receipts"];
  receipts.balcao.debito = 10003;
  return { date, receipts, rates: { debito: 300, credito: 400, pix: 100 }, expectedVersion: null, requestId: randomUUID() };
}
const hasCode = (code: string) => (error: unknown) => error instanceof ApiError && error.code === code;

test("contrato de confirmação exige centavos/percentuais inteiros, campos conhecidos e datas reais", () => {
  const valid = payload();
  assert.equal(salesPayloadSchema.safeParse(valid).success, true);
  for (const amount of [-1, 1.2, MAX_RECEIPT_CENTS + 1, Number.MAX_SAFE_INTEGER, Infinity, "100"]) {
    assert.equal(salesPayloadSchema.safeParse({ ...valid, receipts: { ...valid.receipts, balcao: { ...valid.receipts.balcao, debito: amount } } }).success, false);
  }
  for (const rate of [-1, 10001, 3.5, "3"]) assert.equal(salesPayloadSchema.safeParse({ ...valid, rates: { ...valid.rates, debito: rate } }).success, false);
  assert.equal(salesPayloadSchema.safeParse({ ...valid, total: 1 }).success, false);
  assert.equal(salesPayloadSchema.safeParse({ ...valid, receipts: { ...valid.receipts, other: {} } }).success, false);
  assert.equal(salesPayloadSchema.safeParse({ ...valid, date: "2026-02-29" }).success, false);
  assert.equal(isDate("2028-02-29"), true);
  assert.equal(isDate("0000-01-01"), false);
});

test("backend calcula parcial, zero explícito, cobertura e descontos por recebimento", () => {
  const entry = payload();
  const partial = buildSaleRecord(entry);
  assert.equal(partial.total, 10003);
  assert.equal(partial.values.buffet, null);
  assert.equal(partial.netTotal, null);
  assert.equal(partial.partialNet, null);
  for (const unit of unitIds) for (const method of methods) entry.receipts[unit][method] = 0;
  entry.receipts.balcao.debito = 10003;
  entry.receipts.buffet.debito = 17;
  const complete = buildSaleRecord(entry);
  assert.equal(complete.completeCount, 6);
  assert.equal(complete.feesTotal, 301); // 300.09 -> 300, 0.51 -> 1, antes de somar.
  assert.equal(complete.netTotal, 10020 - 301);
  assert.equal(complete.receipts!.vitrine.pix, 0);
  entry.rates.debito = null;
  const unknownRate = buildSaleRecord(entry);
  assert.equal(unknownRate.netTotal, null);
  assert.equal(unknownRate.netCount, 4);
  assert.equal(unknownRate.partialNet, 0);
  assert.equal(unknownRate.total, 10020);
});

test("limite técnico preserva centavos e campo totalmente ausente não confirma", () => {
  const entry = payload();
  entry.receipts.balcao.debito = MAX_RECEIPT_CENTS;
  assert.equal(buildSaleRecord(entry).total, MAX_RECEIPT_CENTS);
  entry.receipts.balcao.debito = null;
  assert.throws(() => buildSaleRecord(entry), hasCode("INVALID_SALE"));
  entry.receipts.balcao.debito = 0;
  assert.equal(buildSaleRecord(entry).total, 0);
});

test("rascunhos preservam texto inválido sem aceitá-lo como confirmação", () => {
  const draft = emptyUnitSales();
  draft.receipts!.balcao.debito = "a corrigir";
  draft.rates!.debito = "999";
  assert.equal(salesDraftPayloadSchema.safeParse({ draft, expectedVersion: null, baseVersion: null }).success, true);
  assert.equal(salesDraftPayloadSchema.safeParse({ draft, expectedVersion: null, baseVersion: null, total: 10 }).success, false);
});

test("permissões de datas seguem São Paulo e julho fica somente leitura", () => {
  const operator = user("operador");
  assertDatePermission(operator, "2026-10-22", "2026-10-22");
  assert.throws(() => assertDatePermission(operator, "2026-10-21", "2026-10-22"), hasCode("DATE_FORBIDDEN"));
  assert.throws(() => assertDatePermission(user(), "2026-10-23", "2026-10-22"), hasCode("FUTURE_DATE"));
  assert.throws(() => assertDatePermission(user(), "2026-07-01", "2026-10-22"), hasCode("HISTORICAL_READ_ONLY"));
  assert.equal(todayInSaoPaulo(new Date("2026-10-23T02:59:59Z")), "2026-10-22");
  assert.equal(todayInSaoPaulo(new Date("2026-10-23T03:00:00Z")), "2026-10-23");
});

test("hash de idempotência independe da ordem das chaves e inclui o conteúdo", () => {
  assert.equal(canonicalHash({ a: 1, b: { x: null, y: 2 } }), canonicalHash({ b: { y: 2, x: null }, a: 1 }));
  assert.notEqual(canonicalHash({ value: null }), canonicalHash({ value: 0 }));
  assert.notEqual(canonicalHash({ endpoint: "save", data: 1 }), canonicalHash({ endpoint: "date", data: 1 }));
});

test("API de vendas com PostgreSQL: transações, concorrência, permissões e histórico", { skip: !process.env.DATABASE_URL_TEST }, async (t) => {
  const fixture = await createTestDatabase();
  const db = getPool();
  const manager = user();
  const operator = user("operador");
  const other = user("operador");
  const sessionIds = new Map<string, string>();
  const today = todayInSaoPaulo();
  const call = async (actor: AppUser, path: string, method = "GET", body?: unknown) => {
    const req = new Request(`http://localhost${path}`, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
    const result = await handleSales(req, new URL(req.url), { user: actor, sessionId: sessionIds.get(actor.id)! });
    assert.ok(result);
    return await result.json();
  };
  try {
    for (const actor of [manager, operator, other]) {
      await db.query("INSERT INTO users(id,login,name,role,password_hash,password_reset_required) VALUES($1,$2,$3,$4,'fixture-session-only',false)", [actor.id, actor.login, actor.name, actor.role]);
      const session = await db.query<{ id: string }>("INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '7 days') RETURNING id", [actor.id, canonicalHash(actor.id)]);
      sessionIds.set(actor.id, session.rows[0].id);
    }

    let saved: StoredSale;
    let firstEntry: SalesPayload;
    await t.test("confirmação e repetição concorrente retornam uma única revisão com 24 recebimentos", async () => {
      const entry = payload(today);
      firstEntry = entry;
      const responses = await Promise.all([call(operator, `/api/sales/${today}`, "PUT", entry), call(operator, `/api/sales/${today}`, "PUT", entry)]);
      saved = responses[0].sale;
      assert.deepEqual(responses[0], responses[1]);
      assert.equal(saved.version, 1);
      assert.equal(saved.createdBy, operator.id);
      assert.equal(saved.record.total, 10003);
      assert.equal((await db.query("SELECT * FROM sales_revisions")).rowCount, 1);
      assert.equal((await db.query("SELECT * FROM sales_receipts")).rowCount, 24);
      assert.equal((await db.query("SELECT amount FROM sales_receipts WHERE unit_id='buffet' AND method='dinheiro'")).rows[0].amount, null);
      await assert.rejects(call(operator, `/api/sales/${today}`, "PUT", { ...entry, rates: { ...entry.rates, debito: 301 } }), hasCode("REQUEST_ID_REUSED"));
      await assert.rejects(call(operator, `/api/sales/${today}`, "PUT", { ...entry, requestId: randomUUID() }), hasCode("SALE_CONFLICT"));
    });

    await t.test("permissões de leitura e gravação são aplicadas no backend", async () => {
      await assert.rejects(call(other, `/api/sales/${today}`), hasCode("SALE_FORBIDDEN"));
      await assert.rejects(call(other, `/api/sales/${today}`, "PUT", { ...payload(today), expectedVersion: 1 }), hasCode("SALE_FORBIDDEN"));
      assert.deepEqual((await call(other, `/api/sales?month=${today.slice(0, 7)}`)).sales, []);
      await assert.rejects(call(operator, `/api/dashboard?month=${today.slice(0, 7)}`), hasCode("MANAGER_REQUIRED"));
      await assert.rejects(call(operator, "/api/history?month=2026-07"), hasCode("MANAGER_REQUIRED"));
      await assert.rejects(call(manager, "/api/sales/2026-07-02", "PUT", payload("2026-07-02")), hasCode("HISTORICAL_READ_ONLY"));
    });

    await t.test("edições concorrentes não sobrescrevem e auditoria preserva o criador", async () => {
      const entry = { ...payload(today), expectedVersion: 1 };
      entry.receipts.balcao.debito = 20000;
      const results = await Promise.allSettled([call(manager, `/api/sales/${today}`, "PUT", entry), call(operator, `/api/sales/${today}`, "PUT", { ...entry, requestId: randomUUID() })]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const rejection = results.find((result) => result.status === "rejected");
      assert.ok(rejection?.status === "rejected" && hasCode("SALE_CONFLICT")(rejection.reason));
      saved = (await call(manager, `/api/sales/${today}`)).sale;
      assert.equal(saved.version, 2);
      assert.equal(saved.createdBy, operator.id);
      assert.equal(saved.record.total, 20000);
      const revisions = (await call(operator, `/api/sales/${today}/revisions`)).revisions;
      assert.deepEqual(revisions.map((revision: { version: number }) => revision.version), [2, 1]);
      assert.equal(revisions[1].record.total, 10003);
      const dashboard = await call(manager, `/api/dashboard?month=${today.slice(0, 7)}`);
      assert.equal(dashboard.source, "operational");
      assert.equal(dashboard.sales[0].record.total, saved.record.total);
    });

    await t.test("rascunho por usuário versionado retém texto inválido e não entra no dashboard", async () => {
      const draft = emptyUnitSales(); draft.date = today; draft.receipts!.buffet.pix = "a conferir";
      const data = { draft, expectedVersion: null, baseVersion: saved.version };
      const result = await call(operator, `/api/sales-drafts/${today}`, "PUT", data);
      assert.equal(result.draft.version, 1);
      assert.equal(result.draft.draft.receipts.buffet.pix, "a conferir");
      assert.equal((await call(other, `/api/sales-drafts/${today}`)).draft, null);
      const list = await call(operator, `/api/sales-drafts?month=${today.slice(0, 7)}`);
      assert.equal(list.drafts.length, 1);
      assert.equal(list.drafts[0].draft.receipts.buffet.pix, "a conferir");
      assert.deepEqual((await call(other, `/api/sales-drafts?month=${today.slice(0, 7)}`)).drafts, []);
      await assert.rejects(call(operator, `/api/sales-drafts/${today}`, "PUT", data), hasCode("DRAFT_CONFLICT"));
      assert.equal((await call(manager, `/api/dashboard?month=${today.slice(0, 7)}`)).sales.length, 1);
    });

    await t.test("falha na revisão desfaz venda e recebimentos na mesma transação", async () => {
      const earlier = new Date(`${today}T12:00:00Z`); earlier.setUTCDate(earlier.getUTCDate() - 2);
      const date = earlier.toISOString().slice(0, 10);
      const rejectId = randomUUID();
      await db.query(`CREATE FUNCTION reject_test_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.request_id = '${rejectId}'::uuid THEN RAISE EXCEPTION 'test rollback'; END IF; RETURN NEW; END; $$`);
      await db.query("CREATE TRIGGER reject_test_revision BEFORE INSERT ON sales_revisions FOR EACH ROW EXECUTE FUNCTION reject_test_revision()");
      const entry = { ...payload(date), requestId: rejectId };
      await assert.rejects(call(manager, `/api/sales/${date}`, "PUT", entry));
      assert.equal((await call(manager, `/api/sales/${date}`)).sale, null);
      assert.equal((await db.query("SELECT * FROM sales_days")).rowCount, 1);
      assert.equal((await db.query("SELECT * FROM sales_receipts")).rowCount, 24);
      assert.equal((await db.query("SELECT * FROM sales_revisions")).rowCount, 2);
      await db.query("DROP TRIGGER reject_test_revision ON sales_revisions");
      await db.query("DROP FUNCTION reject_test_revision()");
    });

    await t.test("somente gestor muda data, preservando revisão e impedindo colisão", async () => {
      const previousDay = new Date(`${today}T12:00:00Z`); previousDay.setUTCDate(previousDay.getUTCDate() - 1);
      const date = previousDay.toISOString().slice(0, 10);
      const move = { date, expectedVersion: saved.version, requestId: randomUUID() };
      await assert.rejects(call(operator, `/api/sales/${saved.id}/date`, "PATCH", move), hasCode("MANAGER_REQUIRED"));
      const moved = (await call(manager, `/api/sales/${saved.id}/date`, "PATCH", move)).sale;
      assert.equal(moved.id, saved.id);
      assert.equal(moved.createdBy, operator.id);
      assert.equal(moved.record.date, date);
      assert.equal(moved.version, 3);
      assert.equal((await call(manager, `/api/sales/${today}`)).sale, null);
      await call(manager, `/api/sales/${today}`, "PUT", payload(today));
      await assert.rejects(call(manager, `/api/sales/${saved.id}/date`, "PATCH", { date: today, expectedVersion: 3, requestId: randomUUID() }), hasCode("DATE_ALREADY_EXISTS"));
      assert.equal((await call(manager, `/api/sales/${date}/revisions`)).revisions.length, 3);
    });

    await t.test("taxas futuras não recalculam snapshots anteriores e histórico não muda preferências", async () => {
      await db.query("UPDATE users SET default_rates = $1 WHERE id = $2", [{ debito: 123, credito: null, pix: 999 }, manager.id]);
      const earlier = new Date(`${today}T12:00:00Z`); earlier.setUTCDate(earlier.getUTCDate() - 2);
      const date = earlier.toISOString().slice(0, 10);
      const entry = payload(date);
      entry.rates = { debito: 500, credito: 600, pix: null };
      await call(manager, `/api/sales/${date}`, "PUT", entry);
      assert.deepEqual((await db.query("SELECT default_rates FROM users WHERE id = $1", [manager.id])).rows[0].default_rates, { debito: 123, credito: null, pix: 999 });
      const historical = (await call(manager, `/api/sales/${date}`)).sale;
      assert.deepEqual(historical.record.rates, entry.rates);
      const firstRevision = (await db.query("SELECT snapshot FROM sales_revisions WHERE day_id=$1 AND version=1", [saved.id])).rows[0].snapshot;
      assert.equal(firstRevision.record.rates.debito, 300);
    });

    await t.test("julho retorna o payload original e banco impede alteração do histórico", async () => {
      const original = { id: "jul-original", date: "2026-07-01", values: { vendas: null, registrado: 150001 }, note: "Preservado" };
      await db.query("INSERT INTO historical_cash_records(id,date,payload,checksum) VALUES($1,$2,$3,$4)", [original.id, original.date, original, canonicalHash(original)]);
      const july = await call(manager, "/api/dashboard?month=2026-07");
      assert.deepEqual(july, { month: "2026-07", source: "historical", sales: [], historical: [original] });
      await assert.rejects(db.query("UPDATE historical_cash_records SET payload='{}'"));
    });

    await t.test("migração 002 rejeita histórico sem identidade e bloqueia DELETE/TRUNCATE", async () => {
      const hasSqlCode = (code: string) => (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === code;
      for (const [index, invalid] of [
        {},
        { date: "2026-07-02" },
        { id: "jul-invalid" },
        { id: null, date: "2026-07-02" },
        { id: "jul-invalid", date: null },
        { id: 123, date: "2026-07-02" },
        { id: "wrong-id", date: "2026-07-02" },
      ].entries()) {
        await assert.rejects(db.query("INSERT INTO historical_cash_records(id,date,payload,checksum) VALUES($1,$2,$3,$4)", [`jul-invalid-${index}`, "2026-07-02", invalid, canonicalHash(invalid)]), hasSqlCode("23514"));
      }
      await assert.rejects(db.query("DELETE FROM historical_cash_records"), hasSqlCode("P0001"));
      await assert.rejects(db.query("TRUNCATE historical_cash_records"), hasSqlCode("P0001"));
      assert.equal((await db.query("SELECT count(*) FROM historical_cash_records")).rows[0].count, "1");
      const trigger = await db.query<{ truncate: boolean; statement: boolean; insert: boolean }>("SELECT (tgtype::integer & 32) <> 0 AS truncate, (tgtype::integer & 1) = 0 AS statement, (tgtype::integer & 4) <> 0 AS insert FROM pg_trigger WHERE tgname='historical_cash_no_truncate' AND tgrelid='historical_cash_records'::regclass");
      assert.deepEqual(trigger.rows[0], { truncate: true, statement: true, insert: false });
    });

    await t.test("repetição da confirmação no dia seguinte retorna o original sem nova gravação", async (nextDayTest) => {
      const before = (await db.query("SELECT count(*) FROM sales_revisions")).rows[0].count;
      nextDayTest.mock.timers.enable({ apis: ["Date"], now: new Date(`${today}T15:00:00Z`).getTime() + 86_400_000 });
      try {
        const result = await call(operator, `/api/sales/${today}`, "PUT", firstEntry);
        assert.equal(result.sale.id, saved.id);
        assert.equal(result.sale.version, 1);
        assert.equal(result.sale.record.date, today);
        assert.equal((await db.query("SELECT count(*) FROM sales_revisions")).rows[0].count, before);
        await assert.rejects(call(operator, `/api/sales/${today}`, "PUT", { ...firstEntry, requestId: randomUUID() }), hasCode("DATE_FORBIDDEN"));
        const drafts = await call(operator, `/api/sales-drafts?month=${today.slice(0, 7)}`);
        assert.equal(drafts.drafts[0].date, today);
      } finally {
        nextDayTest.mock.timers.reset();
      }
    });

    await t.test("sessão revogada após autenticação inicial não confirma nem salva rascunho", async () => {
      await db.query("DELETE FROM sessions WHERE user_id=$1", [other.id]);
      await assert.rejects(call(other, `/api/sales/${today}`, "PUT", payload(today)), hasCode("UNAUTHENTICATED"));
      const draft = emptyUnitSales(); draft.date = today;
      await assert.rejects(call(other, `/api/sales-drafts/${today}`, "PUT", { draft, expectedVersion: null, baseVersion: null }), hasCode("UNAUTHENTICATED"));
    });
  } finally {
    await fixture.dispose();
  }
});
