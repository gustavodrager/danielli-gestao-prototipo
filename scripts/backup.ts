import { mkdir, open, stat, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Client } from "pg";
import {
  argument,
  administrativeError,
  databaseUrl,
  fileSha256,
  runPgTool,
  snapshotFingerprints,
  type BackupManifest,
} from "./pg-tools.ts";

let client: Client | undefined;
let output: string | undefined;
let archiveStarted = false;
let manifestWritten = false;
try {
  const source = databaseUrl(
    process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL,
  );
  output = resolve(
    argument("output") ??
      `backups/danielli-${new Date().toISOString().replaceAll(":", "-")}.dump`,
  );
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  if (((await stat(dirname(output))).mode & 0o077) !== 0)
    throw new Error(
      "Escolha uma pasta privada (permissão 0700) para guardar o backup.",
    );
  for (const path of [output, `${output}.manifest.json`]) {
    if (
      await stat(path).then(
        () => true,
        () => false,
      )
    )
      throw new Error(
        "O caminho já contém um backup ou manifesto. Escolha um nome novo.",
      );
  }
  client = new Client({
    connectionString: source.toString(),
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const snapshot = (
    await client.query<{ snapshot: string }>(
      "SELECT pg_export_snapshot() AS snapshot",
    )
  ).rows[0].snapshot;
  const fingerprint = await snapshotFingerprints(client);
  await runPgTool(
    "pg_dump",
    source,
    [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      `--schema=${fingerprint.schema}`,
      `--snapshot=${snapshot}`,
    ],
    {
      output,
      onOutputCreated() {
        archiveStarted = true;
      },
    },
  );
  const manifest: BackupManifest = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    ...fingerprint,
    backupSha256: await fileSha256(output),
  };
  const manifestFile = await open(`${output}.manifest.json`, "wx", 0o600);
  manifestWritten = true;
  try {
    await manifestFile.writeFile(`${JSON.stringify(manifest, null, 2)}\n`);
  } finally {
    await manifestFile.close();
  }
  await client.query("COMMIT");
  console.log(
    `Backup criado: ${output}\nManifesto: ${output}.manifest.json\n${manifest.tables.length} tabelas verificadas; SHA256 ${manifest.backupSha256}.`,
  );
} catch (error) {
  await client?.query("ROLLBACK").catch(() => undefined);
  if (archiveStarted && output) await unlink(output).catch(() => undefined);
  if (manifestWritten && output)
    await unlink(`${output}.manifest.json`).catch(() => undefined);
  console.error(
    administrativeError(
      error,
      "Não foi possível criar o backup. Verifique a conexão e as permissões.",
    ),
  );
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => undefined);
}
