import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import {
  enforceCsrf,
  hashPassword,
  tokenHash,
  verifyPassword,
} from "../server/auth.ts";
import { ApiError, json, readJson, todayInSaoPaulo } from "../server/http.ts";

test("scrypt usa salt independente e valida senhas Unicode com parâmetros versionados", async () => {
  const password = "Senha comprida 🍰 para Danielli";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.match(first, /^scrypt\$v1\$131072\$8\$1\$/);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(
    await verifyPassword("Uma outra senha bastante longa", first),
    false,
  );
  assert.equal(await verifyPassword(password, "formato-inválido"), false);
  assert.equal(await verifyPassword(password, undefined), false);
});

test("limites de senha contam caracteres Unicode e não bytes", async () => {
  await assert.rejects(
    hashPassword("🍰".repeat(14)),
    (error: unknown) => error instanceof ApiError && error.status === 422,
  );
  await assert.rejects(
    hashPassword("a".repeat(129)),
    (error: unknown) => error instanceof ApiError && error.status === 422,
  );
  const password = "🍰".repeat(15);
  assert.equal(
    await verifyPassword(password, await hashPassword(password)),
    true,
  );
});

test("CSRF exige origem, cookie protegido, cabeçalho e JSON compatíveis", () => {
  const token = randomBytes(32).toString("base64url");
  const origin = process.env.APP_ORIGIN ?? "https://danielli.example";
  const url = new URL("/api/sales", origin).href;
  const name = url.startsWith("https:")
    ? "__Host-danielli_csrf"
    : "danielli_csrf";
  const headers = {
    origin: new URL(origin).origin,
    "content-type": "application/json",
    "x-csrf-token": token,
    cookie: `${name}=${token}`,
  };
  assert.doesNotThrow(() =>
    enforceCsrf(new Request(url, { method: "POST", headers, body: "{}" })),
  );
  for (const changed of [
    { origin: "https://outro.example" },
    { "x-csrf-token": randomBytes(32).toString("base64url") },
    { cookie: "" },
    { "content-type": "text/plain" },
  ]) {
    assert.throws(
      () =>
        enforceCsrf(
          new Request(url, {
            method: "POST",
            headers: { ...headers, ...changed },
            body: "{}",
          }),
        ),
      ApiError,
    );
  }
  assert.throws(
    () =>
      enforceCsrf(
        new Request(url, {
          method: "POST",
          headers: { ...headers, cookie: `${name}=${token}; ${name}=${token}` },
          body: "{}",
        }),
      ),
    ApiError,
  );
});

test("tokens são hashes SHA256 e não preservam o segredo original", () => {
  const token = randomBytes(32).toString("base64url");
  assert.match(tokenHash(token), /^[a-f0-9]{64}$/);
  assert.notEqual(tokenHash(token), token);
  assert.notEqual(tokenHash(token), tokenHash(`${token}x`));
});

test("leitura JSON rejeita payload inválido, tipo inesperado e mais de 64 KiB", async () => {
  const request = (body: string, type = "application/json") =>
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": type },
      body,
    });
  assert.deepEqual(await readJson(request('{"amount":null}')), {
    amount: null,
  });
  await assert.rejects(
    readJson(request("{")),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
  await assert.rejects(
    readJson(request("{}", "text/plain")),
    (error: unknown) => error instanceof ApiError && error.status === 415,
  );
  await assert.rejects(
    readJson(request(JSON.stringify({ text: "a".repeat(65_536) }))),
    (error: unknown) => error instanceof ApiError && error.status === 413,
  );
  const response = json({ ok: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("dia de São Paulo muda à meia-noite local, incluindo ano", () => {
  assert.equal(todayInSaoPaulo(new Date("2027-01-01T02:59:59Z")), "2026-12-31");
  assert.equal(todayInSaoPaulo(new Date("2027-01-01T03:00:00Z")), "2027-01-01");
});
