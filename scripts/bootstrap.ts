import { z } from "zod";
import { closeDatabase, transaction } from "../server/db.ts";
import { createPasswordToken } from "../server/auth.ts";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? undefined : process.argv[index + 1];
}

try {
  const login = z
    .string()
    .regex(/^[a-z0-9._-]{3,64}$/)
    .parse(argument("login"));
  const origin = new URL(
    z.url().parse(argument("origin") ?? process.env.APP_ORIGIN),
  ).origin;
  const reset = process.argv.includes("--reset");
  const result = await transaction(async (client) => {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('active-managers',0))",
    );
    if (reset) {
      const selected = await client.query<{ id: string }>(
        "SELECT id FROM users WHERE login=$1 AND role='gestor' AND active FOR UPDATE",
        [login],
      );
      if (!selected.rows[0]) throw new Error("Gestor ativo não encontrado.");
      return createPasswordToken(client, selected.rows[0].id);
    }
    const managers = await client.query(
      "SELECT id FROM users WHERE role='gestor' LIMIT 1",
    );
    if (managers.rowCount)
      throw new Error(
        "O primeiro gestor já existe. Use a aplicação para cadastrar contas ou --reset para recuperação administrativa.",
      );
    const name = z.string().trim().min(1).max(120).parse(argument("name"));
    const inserted = await client.query<{ id: string }>(
      "INSERT INTO users(login,name,role) VALUES($1,$2,'gestor') RETURNING id",
      [login, name],
    );
    return createPasswordToken(client, inserted.rows[0].id);
  });
  console.log(
    `Link administrativo de uso único (entregue apenas ao titular):\n${origin}/ativar#token=${result.token}\nVálido até ${result.expiresAt}.`,
  );
} catch (error) {
  console.error(
    error instanceof z.ZodError
      ? "Informe --login, --name e --origin válidos. Na recuperação use --reset --login e --origin."
      : error instanceof Error
        ? error.message
        : "Não foi possível preparar o acesso.",
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
