import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createServer as createViteServer } from "vite";
import { handleRequest } from "../api/index.ts";
import { closeDatabase } from "../server/db.ts";

const port = Number(process.env.PORT ?? 5173);
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: "spa",
});
const server = createServer(async (incoming, outgoing) => {
  if (!incoming.url?.startsWith("/api/")) {
    vite.middlewares(incoming, outgoing);
    return;
  }
  const controller = new AbortController();
  incoming.on("aborted", () => controller.abort());
  try {
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value))
        for (const part of value) headers.append(key, part);
      else if (value !== undefined) headers.set(key, value);
    }
    const body = ["GET", "HEAD"].includes(incoming.method ?? "GET")
      ? undefined
      : (Readable.toWeb(incoming) as ReadableStream<Uint8Array>);
    const init: RequestInit & { duplex?: "half" } = {
      method: incoming.method,
      headers,
      signal: controller.signal,
      ...(body ? { body, duplex: "half" } : {}),
    };
    const response = await handleRequest(
      new Request(
        `http://${incoming.headers.host ?? `127.0.0.1:${port}`}${incoming.url}`,
        init,
      ),
    );
    outgoing.statusCode = response.status;
    for (const [key, value] of response.headers)
      if (key !== "set-cookie") outgoing.setHeader(key, value);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) outgoing.setHeader("set-cookie", cookies);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.statusCode = 500;
    outgoing.setHeader("content-type", "application/json");
    outgoing.end(
      JSON.stringify({
        error: {
          code: "INTERNAL_ERROR",
          message: "Não foi possível concluir a operação.",
        },
      }),
    );
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Danielli Gestão disponível em http://127.0.0.1:${port}`),
);
async function shutdown() {
  server.close();
  await vite.close();
  await closeDatabase();
}
process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
