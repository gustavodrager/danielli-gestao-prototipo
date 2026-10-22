import { Pool, type PoolClient } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { ApiError } from "./http.ts";

let databasePool: Pool | undefined;

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new ApiError(
      503,
      "DATABASE_NOT_CONFIGURED",
      "O sistema ainda não está conectado ao banco de dados.",
    );
  }
  if (!databasePool) {
    databasePool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 15_000,
    });
    // Erros de clientes ociosos não podem derrubar a função nem expor a URL do banco.
    databasePool.on("error", () =>
      console.error("Database pool idle connection error"),
    );
    attachDatabasePool(databasePool);
  }
  return databasePool;
}

export async function transaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  const current = databasePool;
  databasePool = undefined;
  await current?.end();
}
