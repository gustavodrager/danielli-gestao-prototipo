import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { closeDatabase, transaction } from "../server/db.ts";

const source = z
  .array(
    z
      .object({
        id: z.string().min(1),
        date: z.string().regex(/^2026-07-\d{2}$/),
      })
      .passthrough(),
  )
  .length(31);

try {
  const records = source.parse(
    JSON.parse(
      await readFile(new URL("../src/real-cash.json", import.meta.url), "utf8"),
    ),
  );
  if (
    new Set(records.map((record) => record.date)).size !== 31 ||
    new Set(records.map((record) => record.id)).size !== 31
  )
    throw new Error(
      "O histórico deve conter 31 datas e identificadores únicos.",
    );
  for (let day = 1; day <= 31; day++) {
    if (
      !records.some(
        (record) => record.date === `2026-07-${String(day).padStart(2, "0")}`,
      )
    )
      throw new Error("O histórico de julho está incompleto.");
  }
  let added = 0;
  await transaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('danielli-july-import',0))",
    );
    for (const record of records) {
      const payload = JSON.stringify(record);
      const checksum = createHash("sha256").update(payload).digest("hex");
      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM historical_cash_records WHERE id=$1",
        [record.id],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error(
            `Histórico divergente: ${record.id}. Importação interrompida sem substituir valores.`,
          );
        continue;
      }
      await client.query(
        "INSERT INTO historical_cash_records(id,date,payload,checksum) VALUES($1,$2,$3,$4)",
        [record.id, record.date, payload, checksum],
      );
      added++;
    }
  });
  console.log(
    `Julho preservado: ${records.length} registros verificados, ${added} importados.`,
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Não foi possível importar julho.",
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
