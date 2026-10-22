import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import type { Client } from "pg";
import { z } from "zod";

const fingerprints = [
  ["auth_failures", ["id"]],
  ["historical_cash_records", ["id"]],
  ["password_tokens", ["id"]],
  ["sales_days", ["id"]],
  ["sales_drafts", ["user_id", "date"]],
  ["sales_receipts", ["day_id", "unit_id", "method"]],
  ["sales_revisions", ["id"]],
  ["schema_migrations", ["name"]],
  ["sessions", ["id"]],
  ["users", ["id"]],
] as const;

export const manifestSchema = z.strictObject({
  formatVersion: z.literal(1),
  createdAt: z.iso.datetime(),
  schema: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  backupSha256: z.string().regex(/^[a-f0-9]{64}$/),
  tables: z.array(
    z.strictObject({
      table: z.string().regex(/^[a-z_][a-z0-9_]*$/),
      rows: z.string().regex(/^\d+$/),
      md5: z.string().regex(/^[a-f0-9]{32}$/),
    }),
  ),
});
export type BackupManifest = z.infer<typeof manifestSchema>;

export function administrativeError(error: unknown, fallback: string): string {
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return "O manifesto de backup é inválido. Nenhum dado de produção foi alterado.";
  // Mensagens de PostgreSQL, rede e arquivos podem conter metadados de conexão.
  // Somente os erros operacionais controlados deste procedimento são exibidos.
  return error instanceof Error &&
    error.name === "Error" &&
    !("code" in error) &&
    !/postgres(?:ql)?:\/\//i.test(error.message)
    ? error.message
    : fallback;
}

export function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`Informe um caminho depois de --${name}.`);
  return value;
}

export function databaseUrl(value: string | undefined): URL {
  if (!value)
    throw new Error(
      "Configure a conexão de origem e destino antes de usar esta operação administrativa.",
    );
  try {
    const url = new URL(value);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.pathname.slice(1)
    )
      throw new Error();
    return url;
  } catch {
    throw new Error("A conexão PostgreSQL informada é inválida.");
  }
}

export function databaseIdentity(url: URL): string {
  return `${url.hostname.toLowerCase()}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`;
}

export function identifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function snapshotFingerprints(
  client: Client,
  schema?: string,
): Promise<{ schema: string; tables: BackupManifest["tables"] }> {
  await client.query("SET LOCAL TIME ZONE 'UTC'");
  await client.query("SET LOCAL DateStyle='ISO, YMD'");
  const selectedSchema =
    schema ??
    (
      await client.query<{ schema: string }>(
        "SELECT current_schema() AS schema",
      )
    ).rows[0].schema;
  if (!/^[a-z_][a-z0-9_]*$/.test(selectedSchema))
    throw new Error("Use um schema de aplicação com nome simples e explícito.");
  const available = await client.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename",
    [selectedSchema],
  );
  const known = new Set(fingerprints.map(([table]) => table as string));
  const extra = available.rows.find(({ tablename }) => !known.has(tablename));
  if (extra)
    throw new Error(
      "O schema contém uma tabela sem verificação definida. Atualize o procedimento de backup para a nova estrutura.",
    );
  if (
    !available.rows.some(({ tablename }) => tablename === "users") ||
    !available.rows.some(({ tablename }) => tablename === "sales_days")
  )
    throw new Error("A origem não contém a estrutura da aplicação Danielli.");
  const present = new Set(available.rows.map(({ tablename }) => tablename));
  const tables: BackupManifest["tables"] = [];
  for (const [table, keys] of fingerprints) {
    if (!present.has(table)) continue;
    const result = await client.query<{ rows: string; md5: string }>(`
      SELECT count(*)::text AS rows,
        md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY ${keys.map(identifier).join(",")})::text,'[]')) AS md5
      FROM ${identifier(selectedSchema)}.${identifier(table)} AS t`);
    tables.push({ table, ...result.rows[0] });
  }
  return { schema: selectedSchema, tables };
}

export async function fileSha256(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

/** Credenciais só entram no ambiente do processo filho, nunca em argumentos. */
export async function runPgTool(
  tool: "pg_dump" | "pg_restore",
  connection: URL,
  args: string[],
  files: { input?: string; output?: string; onOutputCreated?: () => void } = {},
): Promise<void> {
  const host = connection.hostname.replace(/^\[|\]$/g, "");
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  const container = process.env.PG_TOOL_CONTAINER;
  const pgEnv: Record<string, string> = {
    PGHOST: host,
    PGPORT: process.env.PG_TOOL_PORT ?? (connection.port || "5432"),
    PGDATABASE: decodeURIComponent(connection.pathname.slice(1)),
    PGUSER: decodeURIComponent(connection.username),
    PGPASSWORD: decodeURIComponent(connection.password),
    PGSSLMODE:
      connection.searchParams.get("sslmode") ??
      (local ? "disable" : "verify-full"),
    PGCONNECT_TIMEOUT: "10",
    PGAPPNAME: "danielli-administrative-backup",
    ...(connection.searchParams.get("options")
      ? { PGOPTIONS: connection.searchParams.get("options")! }
      : {}),
    ...(connection.searchParams.get("channel_binding")
      ? { PGCHANNELBINDING: connection.searchParams.get("channel_binding")! }
      : {}),
    ...(connection.searchParams.get("sslrootcert")
      ? { PGSSLROOTCERT: connection.searchParams.get("sslrootcert")! }
      : {}),
  };
  // pg_restore só executa no banco quando --dbname está presente. O argumento
  // é apenas o nome do banco; host, usuário e segredo permanecem no ambiente.
  const toolArgs =
    tool === "pg_restore" ? ["--dbname", pgEnv.PGDATABASE, ...args] : args;
  const command = container ? "docker" : tool;
  const commandArgs = container
    ? [
        "exec",
        "-i",
        ...Object.keys(pgEnv).flatMap((key) => ["-e", key]),
        container,
        tool,
        ...toolArgs,
      ]
    : toolArgs;
  const child = spawn(command, commandArgs, {
    env: { ...process.env, ...pgEnv },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  const finished = new Promise<void>((resolve, reject) => {
    child.once("error", () =>
      reject(
        new Error(
          `Não foi possível iniciar ${tool}. Instale o cliente PostgreSQL ou configure PG_TOOL_CONTAINER.`,
        ),
      ),
    );
    child.once("close", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `${tool} não concluiu a operação. Verifique a versão do cliente PostgreSQL, a conexão e as permissões.`,
            ),
          ),
    );
  });
  const input = files.input
    ? pipeline(createReadStream(files.input), child.stdin)
    : Promise.resolve(child.stdin.end());
  const outputFile = files.output
    ? createWriteStream(files.output, { flags: "wx", mode: 0o600 })
    : undefined;
  outputFile?.once("open", () => files.onOutputCreated?.());
  const output = outputFile
    ? pipeline(child.stdout, outputFile)
    : Promise.resolve(child.stdout.resume());
  try {
    await Promise.all([finished, input, output]);
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }
}
