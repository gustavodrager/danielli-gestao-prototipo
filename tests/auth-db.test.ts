import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";
import {
  authenticate,
  authenticateInTransaction,
  createPasswordToken,
  enforceCsrf,
  handleAuth,
  hashPassword,
  tokenHash,
} from "../server/auth.ts";
import { getPool, transaction } from "../server/db.ts";
import { ApiError } from "../server/http.ts";
import { createTestDatabase } from "./db-helper.ts";

const available = Boolean(process.env.DATABASE_URL_TEST);
let database: { dispose: () => Promise<void> } | undefined;
let managerId: string;
const origin = process.env.APP_ORIGIN ?? "https://danielli.example";
const cookiePrefix = origin.startsWith("https:") ? "__Host-" : "";
const csrf = randomBytes(32).toString("base64url");
const baseCookie = `${cookiePrefix}danielli_csrf=${csrf}`;
let managerCookie = "";

function request(
  path: string,
  method = "GET",
  body?: unknown,
  sessionCookie = managerCookie,
): Request {
  return new Request(new URL(`/api${path}`, origin), {
    method,
    headers: {
      origin: new URL(origin).origin,
      "content-type": "application/json",
      "x-csrf-token": csrf,
      cookie: [baseCookie, sessionCookie].filter(Boolean).join("; "),
      "x-vercel-forwarded-for": "127.0.0.1",
    },
    ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}),
  });
}

async function call(
  path: string,
  method = "GET",
  body?: unknown,
  sessionCookie = managerCookie,
): Promise<Response> {
  const req = request(path, method, body, sessionCookie);
  if (method !== "GET") enforceCsrf(req);
  const response = await handleAuth(req, new URL(req.url));
  assert.ok(response, `Rota ${path} não tratada`);
  return response;
}

function sessionCookie(response: Response): string {
  const value = response.headers
    .getSetCookie()
    .find((item) => item.startsWith(`${cookiePrefix}danielli_session=`));
  assert.ok(value, "Cookie de sessão ausente");
  return value.split(";")[0];
}

before(async () => {
  if (!available) return;
  database = await createTestDatabase();
  const encoded = await hashPassword("Senha longa do gestor 123");
  const created = await getPool().query<{ id: string }>(
    "INSERT INTO users(login,name,role,password_hash,password_reset_required) VALUES('gestor.auth','Gestor Auth','gestor',$1,false) RETURNING id",
    [encoded],
  );
  managerId = created.rows[0].id;
  const response = await call(
    "/auth/login",
    "POST",
    { login: "gestor.auth", password: "Senha longa do gestor 123" },
    "",
  );
  managerCookie = sessionCookie(response);
});

after(async () => {
  await database?.dispose();
});

test(
  "sessão autenticada tem cookie protegido, validade absoluta de sete dias e logout",
  { skip: !available },
  async () => {
    const response = await call(
      "/auth/login",
      "POST",
      { login: "gestor.auth", password: "Senha longa do gestor 123" },
      "",
    );
    const header = response.headers.get("set-cookie")!;
    assert.match(header, /HttpOnly/);
    assert.match(header, /SameSite=Lax/);
    assert.match(header, /Max-Age=604800/);
    if (origin.startsWith("https:")) assert.match(header, /Secure/);
    const loggedCookie = sessionCookie(response);
    const context = await authenticate(
      request("/auth/session", "GET", undefined, loggedCookie),
    );
    assert.equal(context.user.id, managerId);
    const saved = await getPool().query<{ seconds: string }>(
      "SELECT extract(epoch FROM expires_at-created_at) AS seconds FROM sessions WHERE id=$1",
      [context.sessionId],
    );
    assert.equal(Number(saved.rows[0].seconds), 604800);
    await getPool().query(
      "UPDATE sessions SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE id=$1",
      [context.sessionId],
    );
    await assert.rejects(
      authenticate(request("/auth/session", "GET", undefined, loggedCookie)),
      (error: unknown) => error instanceof ApiError && error.status === 401,
    );
    const second = await call(
      "/auth/login",
      "POST",
      { login: "gestor.auth", password: "Senha longa do gestor 123" },
      "",
    );
    const secondCookie = sessionCookie(second);
    await call("/auth/logout", "POST", {}, secondCookie);
    await assert.rejects(
      authenticate(request("/auth/session", "GET", undefined, secondCookie)),
      ApiError,
    );
  },
);

test(
  "gestor cria usuário; ativação é única, expira e desativação revoga sessões",
  { skip: !available },
  async () => {
    const created = await call("/users", "POST", {
      login: "caixa.auth",
      name: "Operador Auth",
      role: "operador",
    });
    assert.equal(created.status, 201);
    const payload = await created.json();
    assert.match(payload.activationUrl, /\/ativar#token=/);
    const token = new URL(payload.activationUrl).hash.slice("#token=".length);
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    const activation = await Promise.allSettled([
      call(
        "/auth/set-password",
        "POST",
        { token, password: "Senha comprida do operador 123" },
        "",
      ),
      call(
        "/auth/set-password",
        "POST",
        { token, password: "Senha comprida do operador 123" },
        "",
      ),
    ]);
    assert.equal(
      activation.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const rejected = activation.find((result) => result.status === "rejected");
    assert.ok(
      rejected?.status === "rejected" &&
        rejected.reason instanceof ApiError &&
        rejected.reason.status === 410,
    );
    await assert.rejects(
      call(
        "/auth/set-password",
        "POST",
        { token, password: "Senha comprida diferente 123" },
        "",
      ),
      (error: unknown) => error instanceof ApiError && error.status === 410,
    );
    const logged = await call(
      "/auth/login",
      "POST",
      { login: "caixa.auth", password: "Senha comprida do operador 123" },
      "",
    );
    const loggedCookie = sessionCookie(logged);
    await assert.rejects(
      call("/users", "GET", undefined, loggedCookie),
      (error: unknown) => error instanceof ApiError && error.status === 403,
    );
    await call(`/users/${payload.user.id}`, "PATCH", { active: false });
    await assert.rejects(
      authenticate(request("/auth/session", "GET", undefined, loggedCookie)),
      ApiError,
    );
    await assert.rejects(
      call(
        "/auth/login",
        "POST",
        { login: "caixa.auth", password: "Senha comprida do operador 123" },
        "",
      ),
      ApiError,
    );
    await call(`/users/${payload.user.id}`, "PATCH", { active: true });
    const resetResponse = await call(
      `/users/${payload.user.id}/reset`,
      "POST",
      {},
    );
    const reset = await resetResponse.json();
    const resetToken = new URL(reset.activationUrl).hash.slice(
      "#token=".length,
    );
    await getPool().query(
      "UPDATE password_tokens SET created_at=now()-interval '1 hour',expires_at=now()-interval '30 minutes' WHERE token_hash=$1",
      [tokenHash(resetToken)],
    );
    await assert.rejects(
      call(
        "/auth/set-password",
        "POST",
        { token: resetToken, password: "Senha comprida diferente 123" },
        "",
      ),
      (error: unknown) => error instanceof ApiError && error.status === 410,
    );
  },
);

test(
  "último gestor ativo não pode ser desativado ou rebaixado",
  { skip: !available },
  async () => {
    await assert.rejects(
      call(`/users/${managerId}`, "PATCH", { active: false }),
      (error: unknown) =>
        error instanceof ApiError && error.code === "LAST_MANAGER",
    );
    await assert.rejects(
      call(`/users/${managerId}`, "PATCH", { role: "operador" }),
      (error: unknown) =>
        error instanceof ApiError && error.code === "LAST_MANAGER",
    );
    await call("/users", "POST", {
      login: "gestor.convite",
      name: "Gestor com convite pendente",
      role: "gestor",
    });
    await assert.rejects(
      call(`/users/${managerId}`, "PATCH", { active: false }),
      (error: unknown) =>
        error instanceof ApiError && error.code === "LAST_MANAGER",
    );
  },
);

test(
  "redefinição e troca de senha revogam sessões e preservam apenas hashes",
  { skip: !available },
  async () => {
    const encoded = await hashPassword("Senha antiga longa para teste");
    const created = await getPool().query<{ id: string }>(
      "INSERT INTO users(login,name,role,password_hash,password_reset_required) VALUES('troca.auth','Troca','operador',$1,false) RETURNING id",
      [encoded],
    );
    const id = created.rows[0].id;
    const logged = await call(
      "/auth/login",
      "POST",
      { login: "troca.auth", password: "Senha antiga longa para teste" },
      "",
    );
    const loggedCookie = sessionCookie(logged);
    const changed = await call(
      "/auth/change-password",
      "POST",
      {
        currentPassword: "Senha antiga longa para teste",
        password: "Senha nova longa para o teste",
      },
      loggedCookie,
    );
    assert.equal(changed.status, 200);
    await assert.rejects(
      authenticate(request("/auth/session", "GET", undefined, loggedCookie)),
      ApiError,
    );
    const renewed = await call(
      "/auth/login",
      "POST",
      { login: "troca.auth", password: "Senha nova longa para o teste" },
      "",
    );
    const renewedCookie = sessionCookie(renewed);
    const another = await call(
      "/auth/login",
      "POST",
      { login: "troca.auth", password: "Senha nova longa para o teste" },
      "",
    );
    const anotherCookie = sessionCookie(another);
    const activation = await transaction((client) =>
      createPasswordToken(client, id),
    );
    await assert.rejects(
      authenticate(request("/auth/session", "GET", undefined, renewedCookie)),
      ApiError,
    );
    await assert.rejects(
      authenticate(request("/auth/session", "GET", undefined, anotherCookie)),
      ApiError,
    );
    const stored = await getPool().query<{ token_hash: string }>(
      "SELECT token_hash FROM password_tokens WHERE user_id=$1",
      [id],
    );
    assert.equal(stored.rows[0].token_hash, tokenHash(activation.token));
    assert.notEqual(stored.rows[0].token_hash, activation.token);
    const expiry = await getPool().query<{ seconds: string }>(
      "SELECT extract(epoch FROM expires_at-created_at) AS seconds FROM password_tokens WHERE user_id=$1",
      [id],
    );
    assert.equal(Number(expiry.rows[0].seconds), 1800);
  },
);

test(
  "limite de login permanece no banco, incluindo usuários inexistentes",
  { skip: !available },
  async () => {
    await getPool().query(
      "INSERT INTO auth_failures(login_key,ip_key) SELECT $1,$2 FROM generate_series(1,10)",
      [tokenHash("login:inexistente.auth"), tokenHash("ip:127.0.0.1")],
    );
    await assert.rejects(
      call(
        "/auth/login",
        "POST",
        {
          login: "inexistente.auth",
          password: "Senha não existente para teste",
        },
        "",
      ),
      (error: unknown) => error instanceof ApiError && error.status === 429,
    );
    await getPool().query(
      "UPDATE auth_failures SET created_at=now()-interval '16 minutes' WHERE login_key=$1",
      [tokenHash("login:inexistente.auth")],
    );
    await assert.rejects(
      call(
        "/auth/login",
        "POST",
        {
          login: "inexistente.auth",
          password: "Senha não existente para teste",
        },
        "",
      ),
      (error: unknown) => error instanceof ApiError && error.status === 401,
    );
  },
);

test(
  "sessão revogada após autenticar não autoriza uma nova gravação transacional",
  { skip: !available },
  async () => {
    const logged = await call(
      "/auth/login",
      "POST",
      { login: "gestor.auth", password: "Senha longa do gestor 123" },
      "",
    );
    const context = await authenticate(
      request("/auth/session", "GET", undefined, sessionCookie(logged)),
    );
    await getPool().query("DELETE FROM sessions WHERE id=$1", [
      context.sessionId,
    ]);
    await assert.rejects(
      transaction((client) => authenticateInTransaction(client, context)),
      (error: unknown) => error instanceof ApiError && error.status === 401,
    );
  },
);
