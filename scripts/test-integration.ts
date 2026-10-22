import { spawnSync } from "node:child_process";
if (!process.env.DATABASE_URL_TEST) {
  console.error(
    "Defina DATABASE_URL_TEST em .env.test.local para validar a API com PostgreSQL real.",
  );
  process.exitCode = 1;
} else {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--test",
      "tests/auth-db.test.ts",
      "tests/sales-api.test.ts",
      "tests/application.test.ts",
    ],
    { stdio: "inherit", env: process.env },
  );
  process.exitCode = result.status ?? 1;
}
