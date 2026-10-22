import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import type { AppUser } from "../shared/contracts.ts";
import { getPool, transaction } from "./db.ts";
import { ApiError, json, readJson, todayInSaoPaulo } from "./http.ts";

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const TOKEN_SECONDS = 30 * 60;
const SCRYPT_OPTIONS = { N: 131_072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const LOGIN_LIMIT = 10;
const IP_LIMIT = 30;
const loginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,64}$/);
const passwordSchema = z.string().refine((value) => {
  const length = Array.from(value).length;
  return length >= 15 && length <= 128;
}, "Use uma senha entre 15 e 128 caracteres.");
const nameSchema = z.string().trim().min(1).max(120);
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const ratesSchema = z
  .object({
    debito: z.number().int().min(0).max(10_000).nullable(),
    credito: z.number().int().min(0).max(10_000).nullable(),
    pix: z.number().int().min(0).max(10_000).nullable(),
  })
  .strict();

export type AuthContext = { user: AppUser; sessionId: string };
type UserRow = {
  id: string;
  login: string;
  name: string;
  role: "gestor" | "operador";
  active: boolean;
  default_rates: AppUser["defaultRates"];
  password_hash?: string | null;
  password_reset_required?: boolean;
  session_id?: string;
};

function appUser(row: UserRow): AppUser {
  return {
    id: row.id,
    login: row.login,
    name: row.name,
    role: row.role,
    active: row.active,
    defaultRates: row.default_rates,
  };
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      422,
      "INVALID_INPUT",
      "Confira os campos informados.",
      parsed.error.issues.map(({ path, message }) => ({
        field: path.join("."),
        message,
      })),
    );
  return parsed.data;
}

export function tokenHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function derivePassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, SCRYPT_OPTIONS, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  parse(passwordSchema, password);
  const salt = randomBytes(16);
  const key = await derivePassword(password, salt);
  return `scrypt$v1$${SCRYPT_OPTIONS.N}$8$1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  encoded: string | null | undefined,
): Promise<boolean> {
  const parts = encoded?.split("$");
  if (
    !parts ||
    parts.length !== 7 ||
    parts.slice(0, 5).join("$") !== "scrypt$v1$131072$8$1"
  ) {
    // Contas inexistentes também executam o custo do hash.
    await derivePassword(password, Buffer.alloc(16));
    return false;
  }
  const salt = Buffer.from(parts[5], "base64url");
  const expected = Buffer.from(parts[6], "base64url");
  if (salt.length !== 16 || expected.length !== 64) return false;
  const actual = await derivePassword(password, salt);
  return timingSafeEqual(actual, expected);
}

function secureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

function cookieName(request: Request, kind: "session" | "csrf"): string {
  return `${secureRequest(request) ? "__Host-" : ""}danielli_${kind}`;
}

function readCookie(request: Request, name: string): string | undefined {
  const parts = (request.headers.get("cookie") ?? "").split(";");
  const values = parts.flatMap((part) => {
    const index = part.indexOf("=");
    return index >= 0 && part.slice(0, index).trim() === name
      ? [part.slice(index + 1).trim()]
      : [];
  });
  return values.length === 1 ? values[0] : undefined;
}

function cookie(
  request: Request,
  kind: "session" | "csrf",
  value: string,
  maxAge: number,
): string {
  return `${cookieName(request, kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureRequest(request) ? "; Secure" : ""}`;
}

function sameSecret(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function enforceCsrf(request: Request): void {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN
    ? new URL(process.env.APP_ORIGIN).origin
    : new URL(request.url).origin;
  if (origin !== expected || new URL(request.url).origin !== expected) {
    throw new ApiError(
      403,
      "INVALID_ORIGIN",
      "Abra o sistema pelo endereço autorizado para continuar.",
    );
  }
  const token = request.headers.get("x-csrf-token") ?? "";
  const stored = readCookie(request, cookieName(request, "csrf")) ?? "";
  if (!tokenSchema.safeParse(token).success || !sameSecret(token, stored)) {
    throw new ApiError(
      403,
      "INVALID_CSRF",
      "Atualize a página antes de tentar novamente.",
    );
  }
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  ) {
    throw new ApiError(415, "JSON_REQUIRED", "Envie os dados no formato JSON.");
  }
}

export async function authenticate(request: Request): Promise<AuthContext> {
  const token = readCookie(request, cookieName(request, "session"));
  if (!token || !tokenSchema.safeParse(token).success)
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "Entre na sua conta para continuar.",
    );
  const result = await getPool().query<UserRow>(
    `
    SELECT u.id,u.login,u.name,u.role,u.active,u.default_rates,s.id AS session_id
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active AND NOT u.password_reset_required`,
    [tokenHash(token)],
  );
  if (!result.rows[0])
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "Sua sessão terminou. Entre novamente.",
    );
  return {
    user: appUser(result.rows[0]),
    sessionId: result.rows[0].session_id!,
  };
}

export function requireManager(context: AuthContext): void {
  if (context.user.role !== "gestor")
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Esta ação está disponível para o gestor.",
    );
}

export async function authenticateInTransaction(
  client: PoolClient,
  context: AuthContext,
): Promise<AuthContext> {
  // A revogação espera uma gravação já autorizada terminar; uma revogação concluída
  // antes desta checagem impede a gravação, mesmo se a requisição começou antes.
  // Ordem explícita usuário → sessão também é usada nas revogações.
  const selectedUser = await client.query<UserRow>(
    `
    SELECT id,login,name,role,active,default_rates FROM users
    WHERE id=$1 AND active AND NOT password_reset_required FOR NO KEY UPDATE`,
    [context.user.id],
  );
  if (!selectedUser.rows[0])
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "Sua sessão terminou. Entre novamente.",
    );
  const session = await client.query(
    "SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND expires_at>now() FOR SHARE",
    [context.sessionId, context.user.id],
  );
  if (!session.rowCount)
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "Sua sessão terminou. Entre novamente.",
    );
  return { user: appUser(selectedUser.rows[0]), sessionId: context.sessionId };
}

export async function createPasswordToken(
  client: PoolClient,
  userId: string,
): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const selected = await client.query(
    "SELECT id FROM users WHERE id=$1 FOR NO KEY UPDATE",
    [userId],
  );
  if (!selected.rowCount)
    throw new ApiError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
  await client.query("DELETE FROM password_tokens WHERE user_id=$1", [userId]);
  await client.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
  await client.query(
    "UPDATE users SET password_reset_required=true,updated_at=now() WHERE id=$1",
    [userId],
  );
  const result = await client.query<{ expires_at: Date }>(
    "INSERT INTO password_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+($3*interval '1 second')) RETURNING expires_at",
    [userId, tokenHash(token), TOKEN_SECONDS],
  );
  return { token, expiresAt: result.rows[0].expires_at.toISOString() };
}

function activationUrl(request: Request, token: string): string {
  const origin = process.env.APP_ORIGIN
    ? new URL(process.env.APP_ORIGIN).origin
    : new URL(request.url).origin;
  return `${origin}/ativar#token=${token}`;
}

async function login(request: Request): Promise<Response> {
  const input = parse(
    z.object({ login: loginSchema, password: z.string().max(1024) }).strict(),
    await readJson(request),
  );
  const ip =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "local";
  const loginKey = tokenHash(`login:${input.login}`);
  const ipKey = tokenHash(`ip:${ip}`);
  const result = await transaction(async (client) => {
    for (const lock of [`login:${loginKey}`, `ip:${ipKey}`].sort()) {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [lock],
      );
    }
    const failures = await client.query<{
      login_count: string;
      ip_count: string;
    }>(
      `
      SELECT count(*) FILTER (WHERE login_key=$1) AS login_count,count(*) FILTER (WHERE ip_key=$2) AS ip_count
      FROM auth_failures WHERE created_at>now()-interval '15 minutes' AND (login_key=$1 OR ip_key=$2)`,
      [loginKey, ipKey],
    );
    if (
      Number(failures.rows[0].login_count) >= LOGIN_LIMIT ||
      Number(failures.rows[0].ip_count) >= IP_LIMIT
    )
      return { limited: true } as const;
    const users = await client.query<UserRow>(
      "SELECT * FROM users WHERE login=$1 FOR UPDATE",
      [input.login],
    );
    const user = users.rows[0];
    const verified = await verifyPassword(input.password, user?.password_hash);
    if (!user || !verified || !user.active || user.password_reset_required) {
      await client.query(
        "INSERT INTO auth_failures(login_key,ip_key) VALUES($1,$2)",
        [loginKey, ipKey],
      );
      return { failure: true } as const;
    }
    const token = randomBytes(32).toString("base64url");
    await client.query(
      "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,now()+($3*interval '1 second'))",
      [user.id, tokenHash(token), SESSION_SECONDS],
    );
    await client.query(
      "DELETE FROM auth_failures WHERE login_key=$1 OR created_at<now()-interval '1 day'",
      [loginKey],
    );
    await client.query("DELETE FROM sessions WHERE expires_at<=now()");
    return { token, user: appUser(user) } as const;
  });
  if ("limited" in result)
    throw new ApiError(
      429,
      "LOGIN_RATE_LIMIT",
      "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.",
    );
  if ("failure" in result)
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Usuário ou senha não conferem, ou a conta precisa ser ativada.",
    );
  return json(
    {
      user: result.user,
      csrfToken: readCookie(request, cookieName(request, "csrf")),
      today: todayInSaoPaulo(),
    },
    200,
    { "Set-Cookie": cookie(request, "session", result.token, SESSION_SECONDS) },
  );
}

async function setPassword(request: Request): Promise<Response> {
  const input = parse(
    z.object({ token: tokenSchema, password: passwordSchema }).strict(),
    await readJson(request),
  );
  const changed = await transaction(async (client) => {
    const owner = await client.query<{ user_id: string }>(
      "SELECT user_id FROM password_tokens WHERE token_hash=$1",
      [tokenHash(input.token)],
    );
    if (!owner.rows[0]) return false;
    const userId = owner.rows[0].user_id;
    const selectedUser = await client.query(
      "SELECT id FROM users WHERE id=$1 AND active FOR NO KEY UPDATE",
      [userId],
    );
    if (!selectedUser.rowCount) return false;
    const selectedToken = await client.query(
      "SELECT id FROM password_tokens WHERE token_hash=$1 AND user_id=$2 AND used_at IS NULL AND expires_at>now() FOR UPDATE",
      [tokenHash(input.token), userId],
    );
    if (!selectedToken.rowCount) return false;
    const encoded = await hashPassword(input.password);
    await client.query(
      "UPDATE users SET password_hash=$1,password_reset_required=false,updated_at=now() WHERE id=$2",
      [encoded, userId],
    );
    await client.query(
      "UPDATE password_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL",
      [userId],
    );
    await client.query("DELETE FROM sessions WHERE user_id=$1", [userId]);
    return true;
  });
  if (!changed)
    throw new ApiError(
      410,
      "TOKEN_EXPIRED",
      "Este link expirou ou já foi usado. Solicite outro ao gestor.",
    );
  return json({ ok: true }, 200, {
    "Set-Cookie": cookie(request, "session", "", 0),
  });
}

async function changePassword(request: Request): Promise<Response> {
  const context = await authenticate(request);
  const input = parse(
    z
      .object({
        currentPassword: z.string().max(1024),
        password: passwordSchema,
      })
      .strict(),
    await readJson(request),
  );
  const changed = await transaction(async (client) => {
    await authenticateInTransaction(client, context);
    const result = await client.query<UserRow>(
      "SELECT * FROM users WHERE id=$1 FOR UPDATE",
      [context.user.id],
    );
    if (
      !(await verifyPassword(
        input.currentPassword,
        result.rows[0]?.password_hash,
      ))
    )
      return false;
    const encoded = await hashPassword(input.password);
    await client.query(
      "UPDATE users SET password_hash=$1,password_reset_required=false,updated_at=now() WHERE id=$2",
      [encoded, context.user.id],
    );
    await client.query("DELETE FROM sessions WHERE user_id=$1", [
      context.user.id,
    ]);
    await client.query("DELETE FROM password_tokens WHERE user_id=$1", [
      context.user.id,
    ]);
    return true;
  });
  if (!changed)
    throw new ApiError(401, "INVALID_PASSWORD", "A senha atual não confere.");
  return json({ ok: true }, 200, {
    "Set-Cookie": cookie(request, "session", "", 0),
  });
}

async function users(request: Request, url: URL): Promise<Response | null> {
  const context = await authenticate(request);
  requireManager(context);
  if (url.pathname === "/api/users" && request.method === "GET") {
    const result = await getPool().query<UserRow>(
      "SELECT id,login,name,role,active,default_rates FROM users ORDER BY name,id",
    );
    return json({ users: result.rows.map(appUser) });
  }
  if (url.pathname === "/api/users" && request.method === "POST") {
    const input = parse(
      z
        .object({
          login: loginSchema,
          name: nameSchema,
          role: z.enum(["gestor", "operador"]),
        })
        .strict(),
      await readJson(request),
    );
    try {
      const result = await transaction(async (client) => {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('active-managers',0))",
        );
        requireManager(await authenticateInTransaction(client, context));
        const user = await client.query<UserRow>(
          "INSERT INTO users(login,name,role) VALUES($1,$2,$3) RETURNING *",
          [input.login, input.name, input.role],
        );
        const activation = await createPasswordToken(client, user.rows[0].id);
        return { user: appUser(user.rows[0]), activation };
      });
      return json(
        {
          user: result.user,
          activationUrl: activationUrl(request, result.activation.token),
          expiresAt: result.activation.expiresAt,
        },
        201,
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      )
        throw new ApiError(
          409,
          "LOGIN_IN_USE",
          "Este identificador de acesso já está em uso.",
        );
      throw error;
    }
  }
  const match = /^\/api\/users\/([0-9a-f-]{36})(\/reset)?$/.exec(url.pathname);
  if (!match || !z.uuid().safeParse(match[1]).success) return null;
  if (match[2] && request.method === "POST") {
    await readJson(request);
    const result = await transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('active-managers',0))",
      );
      requireManager(await authenticateInTransaction(client, context));
      const selected = await client.query<UserRow>(
        "SELECT * FROM users WHERE id=$1 FOR UPDATE",
        [match[1]],
      );
      if (!selected.rows[0]?.active)
        throw new ApiError(
          404,
          "USER_NOT_FOUND",
          "Usuário ativo não encontrado.",
        );
      return createPasswordToken(client, match[1]);
    });
    return json({
      activationUrl: activationUrl(request, result.token),
      expiresAt: result.expiresAt,
    });
  }
  if (!match[2] && request.method === "PATCH") {
    const input = parse(
      z
        .object({
          name: nameSchema.optional(),
          role: z.enum(["gestor", "operador"]).optional(),
          active: z.boolean().optional(),
          defaultRates: ratesSchema.optional(),
        })
        .strict()
        .refine((value) => Object.keys(value).length > 0),
      await readJson(request),
    );
    const result = await transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('active-managers',0))",
      );
      requireManager(await authenticateInTransaction(client, context));
      const selected = await client.query<UserRow>(
        "SELECT * FROM users WHERE id=$1 FOR UPDATE",
        [match[1]],
      );
      const current = selected.rows[0];
      if (!current)
        throw new ApiError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
      const active = input.active ?? current.active;
      const role = input.role ?? current.role;
      if (
        current.active &&
        current.role === "gestor" &&
        (!active || role !== "gestor")
      ) {
        const others = await client.query(
          "SELECT id FROM users WHERE active AND role='gestor' AND password_hash IS NOT NULL AND NOT password_reset_required AND id<>$1 LIMIT 1",
          [current.id],
        );
        if (!others.rowCount)
          throw new ApiError(
            409,
            "LAST_MANAGER",
            "Mantenha pelo menos um gestor com acesso ativado no sistema.",
          );
      }
      const updated = await client.query<UserRow>(
        "UPDATE users SET name=$1,role=$2,active=$3,default_rates=$4,updated_at=now() WHERE id=$5 RETURNING *",
        [
          input.name ?? current.name,
          role,
          active,
          JSON.stringify(input.defaultRates ?? current.default_rates),
          current.id,
        ],
      );
      if (!active || role !== current.role)
        await client.query("DELETE FROM sessions WHERE user_id=$1", [
          current.id,
        ]);
      if (!active)
        await client.query("DELETE FROM password_tokens WHERE user_id=$1", [
          current.id,
        ]);
      return appUser(updated.rows[0]);
    });
    return json({ user: result });
  }
  return null;
}

export async function handleAuth(
  request: Request,
  url: URL,
): Promise<Response | null> {
  if (url.pathname === "/api/auth/session" && request.method === "GET") {
    // A configuração ausente nunca transforma produção em uma sessão demonstrativa.
    getPool();
    let user: AppUser | null = null;
    try {
      user = (await authenticate(request)).user;
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
    const existing = readCookie(request, cookieName(request, "csrf"));
    const csrfToken =
      existing && tokenSchema.safeParse(existing).success
        ? existing
        : randomBytes(32).toString("base64url");
    return json({ user, csrfToken, today: todayInSaoPaulo() }, 200, {
      "Set-Cookie": cookie(request, "csrf", csrfToken, SESSION_SECONDS),
    });
  }
  if (request.method === "POST" && url.pathname === "/api/auth/login")
    return login(request);
  if (request.method === "POST" && url.pathname === "/api/auth/set-password")
    return setPassword(request);
  if (request.method === "POST" && url.pathname === "/api/auth/change-password")
    return changePassword(request);
  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = readCookie(request, cookieName(request, "session"));
    if (token)
      await getPool().query("DELETE FROM sessions WHERE token_hash=$1", [
        tokenHash(token),
      ]);
    return json({ ok: true }, 200, {
      "Set-Cookie": cookie(request, "session", "", 0),
    });
  }
  if (url.pathname === "/api/users" || url.pathname.startsWith("/api/users/"))
    return users(request, url);
  return null;
}
