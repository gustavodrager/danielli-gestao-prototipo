import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { closeDatabase, transaction } from "../server/db.ts";

try {
  const folder = new URL("../db/migrations/", import.meta.url);
  const names = (await readdir(folder))
    .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  await transaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('danielli-migrations',0))",
    );
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of names) {
      const sql = await readFile(new URL(name, folder), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error(
            `Migração já aplicada foi alterada: ${name}. Crie uma nova migração.`,
          );
        continue;
      }
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [name, checksum],
      );
      console.log(`Migração aplicada: ${name}`);
    }
  });
  console.log("Banco atualizado.");
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Não foi possível aplicar as migrações.",
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
