import { hashPassword } from "../server/auth.ts";
import { getPool, closeDatabase } from "../server/db.ts";

const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid");
if (
  !["127.0.0.1", "localhost"].includes(url.hostname) ||
  url.pathname !== "/danielli_dev" ||
  process.env.VERCEL_ENV === "production"
) {
  throw new Error(
    "As contas fictícias são permitidas apenas no banco local danielli_dev.",
  );
}
try {
  const password = await hashPassword("Danielli-teste-local#2026");
  for (const [login, name, role] of [
    ["gestor.teste", "Gestor de teste", "gestor"],
    ["caixa.teste", "Operador de teste", "operador"],
    ["outro.teste", "Outro operador de teste", "operador"],
  ]) {
    await getPool().query(
      "INSERT INTO users(login,name,role,password_hash,password_reset_required) VALUES($1,$2,$3,$4,false) ON CONFLICT(login) DO NOTHING",
      [login, name, role, password],
    );
  }
  console.log(
    "Contas locais de teste preparadas; nenhum usuário de produção foi criado.",
  );
} finally {
  await closeDatabase();
}
