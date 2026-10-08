import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.BASE_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.clock.install({ time: new Date("2026-10-07T15:00:00Z") });
const money = (value) => new RegExp(RegExp.escape(value));
const pass = (label) => process.stdout.write(`✓ ${label}\n`);
async function clearOverflow() {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
}
async function menu(name) {
  await page
    .getByRole("button", { name: "Mudar visão do protótipo", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Visões do protótipo", exact: true })
    .getByRole("link", { name })
    .click();
}
try {
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Visão geral", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "outubro de 2026", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator(".daily-chart button").count(), 7);
  assert.equal(
    await page
      .locator("header")
      .evaluate((e) => getComputedStyle(e).backgroundColor),
    "rgb(0, 0, 0)",
  );
  pass(
    "Mês vigente, outubro parcial, cabeçalho preto e dados fictícios identificados",
  );

  for (const [name, count] of [
    ["maio de 2026", 31],
    ["junho de 2026", 30],
    ["agosto de 2026", 31],
    ["setembro de 2026", 30],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    assert.equal(await page.locator(".daily-chart button").count(), count);
  }
  await page
    .getByRole("button", { name: "julho de 2026", exact: true })
    .click();
  await page.getByText("TOTAL DE VENDAS NO LIVRO", { exact: true }).waitFor();
  assert.match(await page.locator(".hero").innerText(), money("653.640,81"));
  await page.getByRole("link", { name: /Buffet No livro/ }).click();
  await page.getByRole("checkbox", { name: "Somente pendências" }).check();
  await page.getByRole("link", { name: /29\/07\/2026 Página/ }).click();
  await page
    .getByRole("heading", { name: "Fechamento · 29/07/2026", exact: true })
    .waitFor();
  assert.match(await page.getByRole("main").innerText(), /Foto com desfoque/);
  await page.getByRole("link", { name: "Buffet", exact: true }).click();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Somente pendências" })
      .isChecked(),
    true,
  );
  assert.match(page.url(), /mes=2026-07/);
  pass("Julho permanece real, com pendências e contexto preservado no retorno");

  await page
    .getByRole("link", { name: "Visão geral", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Mês atual", exact: true }).click();
  await page.getByRole("button", { name: /01\/10 ·/ }).click();
  await page
    .getByRole("link", { name: "Abrir registros do dia", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "01/10/2026", exact: true })
    .waitFor();
  await page.getByRole("link", { name: /Balcão Registro diário/ }).click();
  await page
    .getByRole("heading", {
      name: "DEMO-2026-10-01-FATURAMENTO-BALCAO",
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("link", { name: "Registros de 01/10/2026", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "01/10/2026", exact: true })
    .waitFor();
  assert.match(page.url(), /mes=2026-10/);
  pass("Gráfico → dia → lançamento → retorno no mesmo mês");

  await page
    .getByRole("navigation", { name: "Navegação principal" })
    .getByRole("link", { name: "Entradas", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Vendas por unidade", exact: true })
    .waitFor();
  await page
    .getByRole("textbox", { name: "Cartão débito de Balcão", exact: true })
    .fill("100");
  await page
    .getByRole("textbox", { name: "Cartão débito de Balcão", exact: true })
    .press("Enter");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    "Cartão crédito de Balcão",
  );
  await page
    .getByRole("textbox", { name: "Cartão crédito de Balcão", exact: true })
    .fill("200");
  await page
    .getByRole("textbox", { name: "Dinheiro de Balcão", exact: true })
    .fill("50");
  await page
    .getByRole("textbox", { name: "Pix de Balcão", exact: true })
    .fill("150");
  await page
    .getByText("Taxas em uso · conferir percentuais", { exact: true })
    .click();
  for (const method of ["Cartão débito", "Cartão crédito", "Pix"])
    await page
      .getByRole("textbox", { name: `Taxa de ${method}`, exact: true })
      .fill("");
  assert.match(await page.locator(".payment-totals").innerText(), /A conferir/);
  await page
    .getByRole("textbox", { name: "Taxa de Cartão débito", exact: true })
    .fill("1,50");
  await page
    .getByRole("textbox", { name: "Taxa de Cartão crédito", exact: true })
    .fill("3,25");
  await page
    .getByRole("textbox", { name: "Taxa de Pix", exact: true })
    .fill("0,50");
  assert.match(
    await page.locator(".payment-totals").innerText(),
    money("491,25"),
  );
  await page
    .getByRole("button", { name: "Revisar valores", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar lançamento parcial", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("heading", { name: "Valores confirmados", exact: true })
    .waitFor();
  assert.match(
    await page.locator(".payment-totals").innerText(),
    money("8,75"),
  );
  pass("Teclado, cálculo de taxas, confirmação parcial e retomada");

  await page
    .getByRole("button", { name: "Novo preenchimento", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Data das vendas", exact: true })
    .fill("2026-10-06");
  await page
    .getByRole("textbox", { name: "Cartão débito de Balcão", exact: true })
    .fill("-1");
  await page
    .getByRole("button", { name: "Revisar valores", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  await page
    .getByRole("button", { name: "Sem movimento nesta unidade", exact: true })
    .click();
  for (const name of ["Buffet", "Massas", "Churrasco", "Marmita", "Vitrine"]) {
    await page
      .getByRole("button", { name: `${name} 0/4 recebimentos`, exact: true })
      .click();
    await page
      .getByRole("button", { name: "Sem movimento nesta unidade", exact: true })
      .click();
  }
  assert.match(
    await page.locator(".payment-totals").innerText(),
    /24\/24 recebimentos/,
  );
  await page.getByRole("button", { name: "Balcão ✓ 4/4", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Cartão débito de Balcão", exact: true })
    .fill("100");
  await page
    .getByText("Taxas em uso · conferir percentuais", { exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Taxa de Cartão débito", exact: true })
    .fill("5");
  await page
    .getByRole("button", { name: "Revisar valores", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirmar recebimentos", exact: true })
    .click();
  assert.match(
    await page.locator(".payment-totals").innerText(),
    money("95,00"),
  );
  await page.getByText("Histórico local · 2 dias", { exact: true }).click();
  await page.getByRole("button", { name: /07\/10\/2026 ·/ }).click();
  assert.match(
    await page.locator(".payment-totals").innerText(),
    money("491,25"),
  );
  pass(
    "Erros, zero explícito, preenchimento completo e taxas históricas preservadas",
  );

  await page
    .getByRole("button", { name: "Novo preenchimento", exact: true })
    .click();
  await page
    .getByText("Taxas em uso · conferir percentuais", { exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Taxa de Cartão débito", exact: true })
      .inputValue(),
    "5,00",
  );
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await clearOverflow();
  }
  await page
    .getByRole("link", {
      name: "Ver registros nos indicadores da simulação",
      exact: true,
    })
    .click();
  await page
    .getByRole("heading", { name: "Registros da simulação", exact: true })
    .waitFor();
  await page
    .getByRole("link", { name: "Visão gerencial", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Visão geral", exact: true })
    .waitFor();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await clearOverflow();
  }
  await menu("Despesas Compras, pessoal e despesas gerais");
  await page
    .getByRole("textbox", { name: "Total de compras", exact: true })
    .fill("23,45");
  await page
    .getByRole("button", { name: "Confirmar compras", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Compras confirmadas", exact: true })
    .waitFor();
  pass(
    "Últimas taxas em uso, três larguras mobile, retorno gerencial e compras",
  );

  const legacy = {
    date: "2026-10-05",
    values: {
      balcao: 10000,
      buffet: null,
      massas: null,
      churrasco: null,
      marmita: null,
      vitrine: null,
    },
    total: 10000,
    count: 1,
  };
  const oldContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await oldContext.addInitScript((record) => {
    sessionStorage.setItem(
      "danielli-demo-v2:sales-history",
      JSON.stringify([record]),
    );
    sessionStorage.setItem(
      "danielli-demo-v2:sales-record",
      JSON.stringify(record),
    );
    sessionStorage.setItem(
      "danielli-demo-v2:sales-draft",
      JSON.stringify({
        date: record.date,
        values: {
          balcao: "100",
          buffet: "",
          massas: "",
          churrasco: "",
          marmita: "",
          vitrine: "",
        },
      }),
    );
  }, legacy);
  const oldPage = await oldContext.newPage();
  await oldPage.goto(`${base}/caixa/vendas`);
  await oldPage
    .getByRole("heading", { name: "Valores confirmados", exact: true })
    .waitFor();
  assert.match(
    await oldPage.getByRole("main").innerText(),
    /Registro antigo · sem detalhamento por recebimento/,
  );
  await oldPage
    .getByRole("button", { name: "Voltar e editar valores", exact: true })
    .click();
  assert.equal(
    await oldPage
      .getByRole("textbox", { name: "Cartão débito de Balcão", exact: true })
      .inputValue(),
    "",
  );
  assert.match(
    await oldPage.getByRole("main").innerText(),
    /Referência anterior/,
  );
  await oldContext.close();
  pass("Registro antigo mantém seu total sem distribuição inventada");
  assert.deepEqual(errors, []);
  pass("Sem erros JavaScript");
} catch (error) {
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/ux-error.png", fullPage: true });
  throw error;
} finally {
  await browser.close();
}
