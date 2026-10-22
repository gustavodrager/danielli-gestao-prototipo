import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleRequest } from "../api/index.ts";
import type {
  AppUser,
  DashboardResponse,
  HistoricalCashRecord,
  SalesPayload,
  SessionResponse,
  StoredSale,
} from "../shared/contracts.ts";
import { hashPassword } from "../server/auth.ts";
import { getPool } from "../server/db.ts";
import { todayInSaoPaulo } from "../server/http.ts";
import { createTestDatabase } from "./db-helper.ts";

const origin = "http://localhost";
const password = "Senha exclusiva dos testes Danielli 123";
const unitIds = [
  "balcao",
  "buffet",
  "massas",
  "churrasco",
  "marmita",
  "vitrine",
] as const;
const methodIds = ["debito", "credito", "dinheiro", "pix"] as const;
type ErrorBody = { error: { code: string; message: string } };

/** Reproduz cookies e cabeçalhos enviados pelo navegador, atravessando o roteador. */
class BrowserClient {
  cookies = new Map<string, string>();
  csrfToken = "";

  async request<T = unknown>(
    path: string,
    method = "GET",
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ) {
    const response = await handleRequest(
      new Request(new URL(path, origin), {
        method,
        headers: {
          origin,
          cookie: [...this.cookies]
            .map(([name, value]) => `${name}=${value}`)
            .join("; "),
          ...(method === "GET"
            ? {}
            : {
                "content-type": "application/json",
                "x-csrf-token": this.csrfToken,
              }),
          ...extraHeaders,
        },
        ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
      }),
    );
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(";");
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (/Max-Age=0(?:;|$)/i.test(header)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const result = (await response.json()) as T;
    if (
      typeof result === "object" &&
      result !== null &&
      "csrfToken" in result &&
      typeof result.csrfToken === "string"
    )
      this.csrfToken = result.csrfToken;
    assert.match(response.headers.get("x-request-id") ?? "", /^[a-f0-9-]{36}$/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    return { response, body: result };
  }

  async login(login: string) {
    await this.request<SessionResponse>("/api/auth/session");
    const result = await this.request<SessionResponse>(
      "/api/auth/login",
      "POST",
      { login, password },
    );
    assert.equal(result.response.status, 200);
    assert.equal(result.body.user?.login, login);
    return result.body.user!;
  }
}

function payload(date = todayInSaoPaulo()): SalesPayload {
  const receipts = Object.fromEntries(
    unitIds.map((unit) => [
      unit,
      Object.fromEntries(methodIds.map((method) => [method, null])),
    ]),
  ) as SalesPayload["receipts"];
  receipts.balcao.debito = 10_003;
  receipts.balcao.dinheiro = 0;
  return {
    date,
    receipts,
    rates: { debito: 300, credito: 400, pix: 100 },
    expectedVersion: null,
    requestId: randomUUID(),
  };
}

test(
  "aplicação completa: cookies e CSRF → API autenticada → PostgreSQL → dashboard e histórico",
  { skip: !process.env.DATABASE_URL_TEST },
  async (t) => {
    const previousOrigin = process.env.APP_ORIGIN;
    delete process.env.APP_ORIGIN;
    const fixture = await createTestDatabase();
    try {
      const encoded = await hashPassword(password);
      for (const [login, role] of [
        ["gestor.app", "gestor"],
        ["caixa.app", "operador"],
        ["outro.app", "operador"],
      ]) {
        await getPool().query(
          "INSERT INTO users(login,name,role,password_hash,password_reset_required) VALUES($1,$1,$2,$3,false)",
          [login, role, encoded],
        );
      }
      const originalJuly = JSON.parse(
        await readFile(
          new URL("../src/real-cash.json", import.meta.url),
          "utf8",
        ),
      ) as HistoricalCashRecord[];
      for (const record of originalJuly) {
        const serialized = JSON.stringify(record);
        await getPool().query(
          "INSERT INTO historical_cash_records(id,date,payload,checksum) VALUES($1,$2,$3,$4)",
          [
            record.id,
            record.date,
            serialized,
            createHash("sha256").update(serialized).digest("hex"),
          ],
        );
      }
      const anonymous = new BrowserClient();
      const manager = new BrowserClient();
      const operator = new BrowserClient();
      const other = new BrowserClient();
      let operatorUser: AppUser;
      let saved: StoredSale;
      let entry = payload();
      const today = entry.date;
      const month = today.slice(0, 7);

      await t.test(
        "sessão pública fornece CSRF; dados e fontes exigem autenticação; sem banco não há simulação",
        async () => {
          const health = await anonymous.request<{ status: string }>(
            "/api/health",
          );
          assert.equal(health.response.status, 200);
          assert.equal(health.body.status, "ok");
          const session = await anonymous.request<SessionResponse>(
            "/api/index?__route=auth%2Fsession",
          );
          assert.equal(session.response.status, 200);
          assert.equal(session.body.user, null);
          assert.match(session.body.csrfToken, /^[A-Za-z0-9_-]{43}$/);
          assert.match(
            session.response.headers.get("set-cookie") ?? "",
            /HttpOnly; SameSite=Lax/,
          );
          for (const path of [
            `/api/dashboard?month=${month}`,
            "/api/history?month=2026-07",
            "/api/history/2026-07-01",
            `/api/sales/${today}`,
            "/api/users",
          ]) {
            const denied = await anonymous.request<ErrorBody>(path);
            assert.equal(denied.response.status, 401, path);
            assert.equal(denied.body.error.code, "UNAUTHENTICATED");
            assert.doesNotMatch(
              JSON.stringify(denied.body),
              /drive\.google\.com|IMG_6383|sourceUrl|password_hash|postgresql:\/\//,
            );
          }
          const configured = process.env.DATABASE_URL;
          try {
            delete process.env.DATABASE_URL;
            const missing =
              await anonymous.request<ErrorBody>("/api/auth/session");
            assert.equal(missing.response.status, 503);
            assert.equal(missing.body.error.code, "DATABASE_NOT_CONFIGURED");
          } finally {
            process.env.DATABASE_URL = configured;
          }
        },
      );

      await t.test(
        "roteador rejeita mutações sem CSRF, origem forjada e conteúdo inadequado inclusive no login",
        async () => {
          const login = { login: "gestor.app", password };
          const rejectedHeaders: Record<string, string>[] = [
            { "x-csrf-token": "" },
            { "x-csrf-token": "token-forjado" },
            { origin: "https://site-externo.example" },
            { "content-type": "text/plain" },
          ];
          for (const headers of rejectedHeaders) {
            const result = await anonymous.request<ErrorBody>(
              "/api/auth/login",
              "POST",
              login,
              headers,
            );
            assert.ok([403, 415].includes(result.response.status));
          }
          assert.equal(
            (await getPool().query("SELECT id FROM sessions")).rowCount,
            0,
          );
          await manager.login("gestor.app");
          operatorUser = await operator.login("caixa.app");
          await other.login("outro.app");
          for (const path of [
            `/api/sales/${today}`,
            `/api/sales-drafts/${today}`,
          ]) {
            const denied = await operator.request<ErrorBody>(
              path,
              "PUT",
              {},
              { "x-csrf-token": "" },
            );
            assert.equal(denied.response.status, 403);
            assert.equal(denied.body.error.code, "INVALID_CSRF");
          }
          for (const path of [
            "/api/users",
            "/api/history?month=2026-07",
            `/api/dashboard?month=${month}`,
          ]) {
            assert.equal(
              (await operator.request<ErrorBody>(path)).response.status,
              403,
              path,
            );
          }
        },
      );

      await t.test(
        "operador confirma e corrige parcial do dia; outro operador não acessa; gestor vê o mesmo snapshot",
        async () => {
          const extraTotal = await operator.request<ErrorBody>(
            `/api/sales/${today}`,
            "PUT",
            { ...entry, total: 1 },
          );
          assert.equal(extraTotal.response.status, 400);
          const created = await operator.request<{ sale: StoredSale }>(
            `/api/sales/${today}`,
            "PUT",
            entry,
          );
          assert.equal(created.response.status, 200);
          saved = created.body.sale;
          assert.equal(saved.version, 1);
          assert.equal(saved.createdBy, operatorUser.id);
          assert.equal(saved.record.total, 10_003);
          assert.deepEqual(saved.record.receipts, entry.receipts);
          assert.equal(saved.record.receipts!.balcao.dinheiro, 0);
          assert.equal(saved.record.receipts!.buffet.pix, null);
          assert.equal(saved.record.netTotal, null);
          const seen = await manager.request<DashboardResponse>(
            `/api/dashboard?month=${month}`,
          );
          assert.deepEqual(
            seen.body.sales.find((sale) => sale.id === saved.id),
            saved,
          );
          assert.equal(
            (await other.request<ErrorBody>(`/api/sales/${today}`)).response
              .status,
            403,
          );
          assert.equal(
            (
              await other.request<ErrorBody>(`/api/sales/${today}`, "PUT", {
                ...entry,
                expectedVersion: 1,
                requestId: randomUUID(),
              })
            ).response.status,
            403,
          );
          entry = {
            ...entry,
            receipts: {
              ...entry.receipts,
              balcao: { ...entry.receipts.balcao, pix: 2_500 },
            },
            expectedVersion: 1,
            requestId: randomUUID(),
          };
          const corrected = await operator.request<{ sale: StoredSale }>(
            `/api/sales/${today}`,
            "PUT",
            entry,
          );
          assert.equal(corrected.response.status, 200);
          saved = corrected.body.sale;
          assert.equal(saved.version, 2);
          assert.equal(saved.record.total, 12_503);
          assert.equal(
            (
              await operator.request<{ revisions: unknown[] }>(
                `/api/sales/${today}/revisions`,
              )
            ).body.revisions.length,
            2,
          );
          const repeated = await operator.request<{ sale: StoredSale }>(
            `/api/sales/${today}`,
            "PUT",
            entry,
          );
          assert.equal(repeated.response.status, 200);
          assert.deepEqual(repeated.body.sale, saved);
          const stale = await operator.request<ErrorBody>(
            `/api/sales/${today}`,
            "PUT",
            { ...entry, requestId: randomUUID() },
          );
          assert.equal(stale.response.status, 409);
          const dashboard = await manager.request<DashboardResponse>(
            `/api/dashboard?month=${month}`,
          );
          assert.deepEqual(
            dashboard.body.sales.find((sale) => sale.id === saved.id),
            saved,
          );
          const yesterday = new Date(`${today}T12:00:00Z`);
          yesterday.setUTCDate(yesterday.getUTCDate() - 1);
          const retroactive = payload(yesterday.toISOString().slice(0, 10));
          assert.equal(
            (
              await operator.request<ErrorBody>(
                `/api/sales/${retroactive.date}`,
                "PUT",
                retroactive,
              )
            ).response.status,
            403,
          );
          assert.equal(
            (
              await getPool().query(
                "SELECT count(*)::integer AS count FROM sales_days",
              )
            ).rows[0].count,
            1,
          );
        },
      );

      await t.test(
        "rascunho com texto inválido fica privado e não entra no dashboard",
        async () => {
          const draft = {
            date: today,
            values: Object.fromEntries(unitIds.map((unit) => [unit, ""])),
            receipts: Object.fromEntries(
              unitIds.map((unit) => [
                unit,
                Object.fromEntries(
                  methodIds.map((method) => [
                    method,
                    unit === "balcao" && method === "credito"
                      ? "a corrigir"
                      : "",
                  ]),
                ),
              ]),
            ),
            rates: { debito: "3", credito: "4", pix: "1" },
          };
          const savedDraft = await operator.request<{
            draft: { draft: typeof draft };
          }>(`/api/sales-drafts/${today}`, "PUT", {
            draft,
            expectedVersion: null,
            baseVersion: saved.version,
          });
          assert.equal(savedDraft.response.status, 200);
          assert.deepEqual(savedDraft.body.draft.draft, draft);
          assert.equal(
            (
              await other.request<{ draft: unknown }>(
                `/api/sales-drafts/${today}`,
              )
            ).body.draft,
            null,
          );
          const dashboard = await manager.request<DashboardResponse>(
            `/api/dashboard?month=${month}`,
          );
          assert.equal(
            dashboard.body.sales.find((sale) => sale.id === saved.id)?.record
              .total,
            12_503,
          );
        },
      );

      await t.test(
        "cadastro, ativação única, reset, desativação e sessão expirada atravessam a API completa",
        async () => {
          const created = await manager.request<{
            user: AppUser;
            activationUrl: string;
            expiresAt: string;
          }>("/api/users", "POST", {
            login: "novo.app",
            name: "Operador criado pela API",
            role: "operador",
          });
          assert.equal(created.response.status, 201);
          const newcomer = new BrowserClient();
          await newcomer.request("/api/auth/session");
          const token = new URL(created.body.activationUrl).hash.slice(
            "#token=".length,
          );
          assert.equal(
            (
              await newcomer.request("/api/auth/set-password", "POST", {
                token,
                password,
              })
            ).response.status,
            200,
          );
          assert.equal(
            (
              await newcomer.request<ErrorBody>(
                "/api/auth/set-password",
                "POST",
                { token, password },
              )
            ).response.status,
            410,
          );
          await newcomer.login("novo.app");
          assert.equal(
            (await newcomer.request<ErrorBody>("/api/users")).response.status,
            403,
          );
          await getPool().query(
            "UPDATE sessions SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE user_id=$1",
            [created.body.user.id],
          );
          assert.equal(
            (await newcomer.request<SessionResponse>("/api/auth/session")).body
              .user,
            null,
          );
          assert.equal(
            (await newcomer.request<ErrorBody>(`/api/sales?month=${month}`))
              .response.status,
            401,
          );
          await newcomer.login("novo.app");
          const reset = await manager.request<{ activationUrl: string }>(
            `/api/users/${created.body.user.id}/reset`,
            "POST",
            {},
          );
          assert.equal(reset.response.status, 200);
          assert.equal(
            (await newcomer.request<ErrorBody>(`/api/sales?month=${month}`))
              .response.status,
            401,
          );
          const resetToken = new URL(reset.body.activationUrl).hash.slice(
            "#token=".length,
          );
          assert.equal(
            (
              await newcomer.request("/api/auth/set-password", "POST", {
                token: resetToken,
                password,
              })
            ).response.status,
            200,
          );
          await newcomer.login("novo.app");
          assert.equal(
            (
              await manager.request(
                `/api/users/${created.body.user.id}`,
                "PATCH",
                { active: false },
              )
            ).response.status,
            200,
          );
          assert.equal(
            (await newcomer.request<ErrorBody>(`/api/sales?month=${month}`))
              .response.status,
            401,
          );
          assert.equal(
            (
              await newcomer.request<ErrorBody>("/api/auth/login", "POST", {
                login: "novo.app",
                password,
              })
            ).response.status,
            401,
          );
        },
      );

      await t.test(
        "julho exige gestor, preserva todo JSON e checksums e rejeita alteração operacional",
        async () => {
          const history = await manager.request<{
            historical: HistoricalCashRecord[];
          }>("/api/history?month=2026-07");
          assert.equal(history.response.status, 200);
          assert.deepEqual(history.body.historical, originalJuly);
          const dashboard = await manager.request<DashboardResponse>(
            "/api/dashboard?month=2026-07",
          );
          assert.equal(dashboard.body.source, "historical");
          assert.deepEqual(dashboard.body.sales, []);
          assert.deepEqual(dashboard.body.historical, originalJuly);
          const detail = await manager.request<{
            historical: HistoricalCashRecord;
          }>("/api/history/2026-07-01");
          assert.deepEqual(detail.body.historical, originalJuly[0]);
          for (const record of originalJuly) {
            const stored = await getPool().query<{
              payload: HistoricalCashRecord;
              checksum: string;
            }>(
              "SELECT payload,checksum FROM historical_cash_records WHERE id=$1",
              [record.id],
            );
            assert.deepEqual(stored.rows[0].payload, record);
            assert.equal(
              stored.rows[0].checksum,
              createHash("sha256").update(JSON.stringify(record)).digest("hex"),
            );
          }
          const changed = await manager.request<ErrorBody>(
            "/api/sales/2026-07-01",
            "PUT",
            payload("2026-07-01"),
          );
          assert.equal(changed.response.status, 409);
          assert.equal(changed.body.error.code, "HISTORICAL_READ_ONLY");
          await operator.request("/api/auth/logout", "POST", {});
          assert.equal(
            (await operator.request<ErrorBody>(`/api/sales/${today}`)).response
              .status,
            401,
          );
          assert.equal(
            (await operator.request<SessionResponse>("/api/auth/session")).body
              .user,
            null,
          );
        },
      );
    } finally {
      await fixture.dispose();
      if (previousOrigin === undefined) delete process.env.APP_ORIGIN;
      else process.env.APP_ORIGIN = previousOrigin;
    }
  },
);
