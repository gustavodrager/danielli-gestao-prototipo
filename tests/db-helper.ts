import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";
import { closeDatabase, getPool } from "../server/db.ts";

export async function createTestDatabase() {
  const base = process.env.DATABASE_URL_TEST;
  if (!base)
    throw new Error(
      "Defina DATABASE_URL_TEST para executar testes com PostgreSQL real.",
    );
  const schema = `test_danielli_${randomUUID().replaceAll("-", "")}`;
  const original = process.env.DATABASE_URL;
  const admin = new Pool({ connectionString: base });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(base);
  url.searchParams.set("options", `-c search_path=${schema},public`);
  await closeDatabase();
  process.env.DATABASE_URL = url.toString();
  try {
    const folder = new URL("../db/migrations/", import.meta.url);
    for (const name of (await readdir(folder))
      .filter((n) => /^\d+_.*\.sql$/.test(n))
      .sort()) {
      await getPool().query(await readFile(new URL(name, folder), "utf8"));
    }
  } catch (error) {
    await closeDatabase();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
    throw error;
  }
  return {
    schema,
    async dispose() {
      await closeDatabase();
      if (original === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = original;
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    },
  };
}
