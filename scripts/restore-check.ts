import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";
import {
  argument,
  administrativeError,
  databaseIdentity,
  databaseUrl,
  fileSha256,
  identifier,
  manifestSchema,
  runPgTool,
  snapshotFingerprints,
} from "./pg-tools.ts";

let client: Client | undefined;
try {
  const input = argument("input");
  if (!input)
    throw new Error("Informe --input com o caminho do backup a verificar.");
  const archive = resolve(input);
  const source = databaseUrl(
    process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL,
  );
  const target = databaseUrl(process.env.RESTORE_DATABASE_URL);
  if (databaseIdentity(source) === databaseIdentity(target))
    throw new Error(
      "A restauração exige um banco vazio diferente da origem. Nenhum dado foi alterado.",
    );
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(`${archive}.manifest.json`, "utf8")),
  );
  if ((await fileSha256(archive)) !== manifest.backupSha256)
    throw new Error(
      "O arquivo de backup diverge do manifesto. A restauração não foi iniciada.",
    );
  client = new Client({
    connectionString: target.toString(),
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  const occupied =
    await client.query(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
      AND c.relkind IN ('r','p','v','m','S','f')
    UNION ALL SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
    LIMIT 1`);
  if (occupied.rowCount)
    throw new Error(
      "O banco de destino não está vazio. A restauração não foi iniciada.",
    );
  // Bancos novos já contêm o schema public, que também está no arquivo.
  // Sem CASCADE: qualquer objeto inesperado impede a preparação do destino.
  await client.query(`DROP SCHEMA IF EXISTS ${identifier(manifest.schema)}`);
  await runPgTool(
    "pg_restore",
    target,
    ["--single-transaction", "--exit-on-error", "--no-owner", "--no-acl"],
    { input: archive },
  );
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const restored = await snapshotFingerprints(client, manifest.schema);
  try {
    assert.deepEqual(restored.tables, manifest.tables);
  } catch {
    throw new Error(
      "O banco restaurado não corresponde às contagens e aos resumos do backup. Não utilize este destino como produção.",
    );
  }
  await client.query("COMMIT");
  console.log(
    `Restauração verificada: ${archive}\n${manifest.tables.length} tabelas com contagens e resumos idênticos; SHA256 ${manifest.backupSha256}.`,
  );
} catch (error) {
  await client?.query("ROLLBACK").catch(() => undefined);
  console.error(
    administrativeError(
      error,
      "Não foi possível verificar a restauração. Confira o arquivo, a conexão e as permissões.",
    ),
  );
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => undefined);
}
