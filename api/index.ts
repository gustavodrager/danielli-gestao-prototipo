import { randomUUID } from "node:crypto";
import { authenticate, enforceCsrf, handleAuth } from "../server/auth.ts";
import { getPool } from "../server/db.ts";
import { ApiError, json } from "../server/http.ts";
import { handleSales } from "../server/sales.ts";

function responseHeaders(response: Response, requestId: string): Response {
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function handleRequest(request: Request): Promise<Response> {
  const requestId = randomUUID();
  const url = new URL(request.url);
  // A Vercel encaminha todas as rotas a esta única função. Em desenvolvimento
  // a URL já contém a rota original; o parâmetro cobre a URL reescrita.
  const route = url.searchParams.get("__route");
  if (
    route !== null &&
    (url.pathname === "/api" || url.pathname === "/api/index")
  ) {
    url.pathname = `/api/${route}`;
    url.searchParams.delete("__route");
  }
  try {
    if (!url.pathname.startsWith("/api/"))
      throw new ApiError(404, "NOT_FOUND", "Página não encontrada.");
    if (url.pathname === "/api/health" && request.method === "GET") {
      const result = await getPool().query(
        "SELECT to_regclass('users') IS NOT NULL AND to_regclass('sales_days') IS NOT NULL AS ready",
      );
      if (!result.rows[0]?.ready)
        throw new ApiError(
          503,
          "DATABASE_NOT_READY",
          "A configuração do banco ainda não foi concluída.",
        );
      return responseHeaders(json({ status: "ok" }), requestId);
    }
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      throw new ApiError(
        405,
        "METHOD_NOT_ALLOWED",
        "Esta operação não está disponível.",
      );
    }
    if (request.method !== "GET") enforceCsrf(request);
    const authResponse = await handleAuth(request, url);
    if (authResponse) return responseHeaders(authResponse, requestId);
    const context = await authenticate(request);
    const salesResponse = await handleSales(request, url, context);
    if (salesResponse) return responseHeaders(salesResponse, requestId);
    throw new ApiError(404, "NOT_FOUND", "Esta operação não foi encontrada.");
  } catch (error) {
    if (error instanceof ApiError) {
      return responseHeaders(
        json(
          {
            error: {
              code: error.code,
              message: error.message,
              ...(error.details === undefined
                ? {}
                : { details: error.details }),
            },
          },
          error.status,
        ),
        requestId,
      );
    }
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : "INTERNAL";
    // Identificadores permitem correlacionar falhas sem registrar dados pessoais,
    // credenciais, corpos de requisição ou parâmetros da conexão.
    console.error(JSON.stringify({ event: "api_error", requestId, code }));
    const unavailable = [
      "ECONNREFUSED",
      "ENOTFOUND",
      "ETIMEDOUT",
      "08006",
      "57P01",
      "42P01",
    ].includes(code);
    return responseHeaders(
      json(
        {
          error: {
            code: unavailable ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR",
            message: unavailable
              ? "O sistema está temporariamente indisponível. Seu preenchimento pode ser retomado."
              : "Não foi possível concluir a operação. Tente novamente.",
            requestId,
          },
        },
        unavailable ? 503 : 500,
      ),
      requestId,
    );
  }
}

export default { fetch: handleRequest };
