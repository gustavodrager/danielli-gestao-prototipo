import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
const bundled = process.env.CHROMIUM_BUNDLE
  ? (await import(process.env.CHROMIUM_BUNDLE)).default
  : null;
const browser = await chromium.launch(
  bundled
    ? {
        executablePath:
          process.env.CHROMIUM_EXECUTABLE || (await bundled.executablePath()),
        args: bundled.args,
        headless: true,
      }
    : { headless: true },
);
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
});
const page = await context.newPage();
const failures = [];
const results = [];
page.on("pageerror", (error) => failures.push(error.message));
const base = process.env.BASE_URL || "http://127.0.0.1:5173";
const open = async (path) => {
  await page.goto(base + path);
  await page.locator("main h1").waitFor();
};
const settle = async () =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
const text = async () => {
  await settle();
  return page.locator("main").innerText();
};
const pass = (name) => {
  results.push(name);
  console.log("PASS", name);
};
mkdirSync("artifacts", { recursive: true });
try {
  await open("/");
  assert.match(await text(), /653\.640,81/);
  for (const name of [
    "Balcão",
    "Buffet",
    "Massas",
    "Churrasco",
    "Marmita",
    "Vitrine",
  ])
    assert.match(await text(), new RegExp(name));
  assert.equal(
    await page
      .locator("main")
      .getByText("Sem dados identificados neste período", { exact: true })
      .count(),
    3,
  );
  assert.equal(
    await page
      .locator("details")
      .filter({
        has: page.getByText("Indicadores sem fonte · o que falta", {
          exact: true,
        }),
      })
      .getAttribute("open"),
    null,
  );
  pass("Histórico real: seis unidades, subtotais e lacunas sem inventar mix");
  await page.locator('a[href="/indicadores/faturamento/buffet"]').click();
  await settle();
  await page.getByLabel("Buscar data").fill("25/07");
  await page.getByLabel("Somente pendências").click();
  await settle();
  await page.waitForFunction(
    () => document.querySelector(".filter-check input")?.checked === true,
  );
  assert.match(await text(), /1 de 31 dias/);
  await page.getByRole("link", { name: "25/07/2026", exact: false }).click();
  await settle();
  await page.locator("a.back").click();
  await settle();
  assert.equal(await page.getByLabel("Buscar data").inputValue(), "25/07");
  assert.equal(await page.getByLabel("Somente pendências").isChecked(), true);
  assert.match(await page.locator("h1").innerText(), /Buffet/);
  pass("Dia retorna ao indicador com busca e filtro preservados");
  await open("/");
  await page.locator(".daily-chart button").first().click();
  await settle();
  assert.match(
    await page.locator(".chart-selection").innerText(),
    /01\/07\/2026/,
  );
  await page
    .getByRole("link", { name: "Abrir fechamento", exact: false })
    .click();
  await settle();
  await page.waitForURL("**/caixa/historico/real-01");
  assert.match(await page.locator("h1").innerText(), /01\/07\/2026/);
  pass("Gráfico diário seleciona data/valor antes de abrir fechamento");
  await open("/caixa/vendas");
  for (const width of [320, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `overflow vendas ${width}`,
    );
    if (width === 390) {
      const box = await page
        .getByRole("button", { name: "Confirmar valores", exact: false })
        .boundingBox();
      assert.ok(
        box.y + box.height <= 844,
        `confirmar abaixo da tela: ${JSON.stringify(box)}`,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Confirmar valores", exact: false })
          .evaluate((n) => {
            const r = n.getBoundingClientRect();
            return n.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            );
          }),
        true,
        "Confirmar está coberto",
      );
    }
    await page.screenshot({
      path: `artifacts/vendas-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Data das vendas").fill("2026-10-06");
  await page.getByLabel("Balcão", { exact: true }).fill("100");
  await page.getByLabel("Balcão", { exact: true }).press("Enter");
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    "unit-sales-buffet",
  );
  await page.getByLabel("Buffet", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Confirmar valores", exact: false })
    .click();
  await settle();
  assert.match(await text(), /2 de 6 unidades informadas/);
  assert.match(await text(), /Não informado/);
  await page.reload();
  assert.match(await text(), /Valores confirmados/);
  await page
    .getByRole("button", { name: "Novo preenchimento", exact: true })
    .click();
  await settle();
  await page.getByLabel("Data das vendas").fill("2026-10-07");
  await page.getByLabel("Marmita", { exact: true }).fill("50");
  await page
    .getByRole("button", { name: "Confirmar valores", exact: false })
    .click();
  await settle();
  await page
    .getByRole("button", { name: "Editar valores", exact: true })
    .click();
  await settle();
  await page.getByLabel("Marmita", { exact: true }).fill("55");
  await page
    .getByRole("button", { name: "Confirmar valores", exact: false })
    .click();
  await settle();
  await page
    .getByRole("link", {
      name: "Ver registros nos indicadores da simulação",
      exact: true,
    })
    .click();
  await settle();
  assert.match(await text(), /155,00/);
  assert.match(await text(), /2 dias/);
  pass(
    "Vendas: zero/ausência, Enter, ação na primeira tela, edição, histórico e retomada",
  );
  await open("/compras/cmv");
  await page.getByLabel("Data das compras").fill("2026-10-06");
  await page
    .getByRole("button", { name: "Confirmar compras", exact: false })
    .click();
  await settle();
  assert.match(await page.getByRole("alert").innerText(), /Informe o total/);
  await page.getByLabel("Total de compras", { exact: true }).fill("abc");
  await page
    .getByRole("button", { name: "Confirmar compras", exact: false })
    .click();
  await settle();
  assert.equal(
    await page.locator("#purchase-amount").getAttribute("aria-invalid"),
    "true",
  );
  await page.getByLabel("Total de compras", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "Confirmar compras", exact: false })
    .click();
  await settle();
  assert.match(await text(), /Compras confirmadas/);
  await page
    .getByRole("button", { name: "Novo preenchimento", exact: true })
    .click();
  await settle();
  await page.getByLabel("Data das compras").fill("2026-10-07");
  await page.getByLabel("Total de compras", { exact: true }).fill("25");
  await page
    .getByRole("button", { name: "Confirmar compras", exact: false })
    .click();
  await settle();
  await page
    .getByRole("link", {
      name: "Ver registros nos indicadores da simulação",
      exact: true,
    })
    .click();
  await settle();
  assert.match(await text(), /25,00/);
  assert.equal(
    await page.getByRole("link", { name: /fornecedor|documento/i }).count(),
    0,
  );
  pass(
    "Compras: ausência/invalidade/zero, histórico e soma sem composição inventada",
  );
  await open("/caixa/novo");
  await page.getByLabel("Data *", { exact: true }).fill("2026-10-06");
  await page
    .getByLabel("Responsável pelo fechamento *", { exact: true })
    .fill("Operador de teste");
  await page.getByLabel("Total de vendas", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Continuar", exact: false }).click();
  await settle();
  await page.getByRole("button", { name: /Reaproveitar vendas de/ }).click();
  await settle();
  assert.equal(
    await page.getByLabel("Balcão", { exact: true }).inputValue(),
    "100.00",
  );
  await page.getByRole("button", { name: "Continuar", exact: false }).click();
  await settle();
  await page
    .getByRole("button", { name: "Conferir fechamento", exact: false })
    .click();
  await settle();
  assert.match(await text(), /Não informado/);
  assert.equal(
    await page.locator(".difference strong").innerText(),
    "A conferir",
  );
  assert.doesNotMatch(
    await page.locator(".difference").innerText(),
    /-.*100,00/,
  );
  await page
    .getByRole("link", { name: "Editar recebimentos", exact: true })
    .click();
  await settle();
  for (const method of [
    "Dinheiro",
    "Pix",
    "Débito",
    "Crédito",
    "Voucher",
    "iFood",
  ])
    await page.getByLabel(method, { exact: true }).fill("0");
  await page.getByRole("button", { name: "Continuar", exact: false }).click();
  await settle();
  await page.getByLabel("Balcão", { exact: true }).fill("110");
  await page.getByRole("button", { name: "Continuar", exact: false }).click();
  await settle();
  await page
    .getByRole("button", { name: "Conferir fechamento", exact: false })
    .click();
  await settle();
  assert.match(
    await page.locator(".difference strong").innerText(),
    /-.*100,00/,
  );
  await page
    .getByRole("button", { name: "Concluir simulação", exact: false })
    .click();
  await settle();
  await page.reload();
  assert.match(await text(), /SIMULAÇÃO CONCLUÍDA/);
  await open("/caixa/vendas");
  assert.match(await text(), /110,00/);
  pass(
    "Fechamento: reaproveitamento bidirecional, referência independente e diferença somente completa",
  );
  await open("/caixa");
  await page
    .getByRole("button", { name: "Preparar nova simulação", exact: true })
    .click();
  await settle();
  await page
    .getByRole("link", { name: "Iniciar fechamento", exact: false })
    .click();
  await settle();
  await page
    .getByText("Exemplo fictício para demonstração", { exact: true })
    .click();
  await settle();
  await page
    .getByRole("button", { name: "Preencher exemplo fictício", exact: false })
    .click();
  await settle();
  await page.getByLabel("Data *", { exact: true }).fill("2026-10-06");
  await page.getByRole("button", { name: "Continuar", exact: false }).click();
  await settle();
  await page.getByLabel("Balcão", { exact: true }).fill("99");
  await page.reload();
  await settle();
  assert.equal(
    await page.getByLabel("Balcão", { exact: true }).inputValue(),
    "99",
  );
  await page.getByRole("button", { name: "Continuar", exact: false }).click();
  await settle();
  await page
    .getByRole("button", { name: "Conferir fechamento", exact: false })
    .click();
  await settle();
  await page
    .getByRole("button", { name: "Concluir simulação", exact: false })
    .click();
  await settle();
  await open("/caixa");
  const localLinks = page.locator('a[href^="/caixa/historico/local-"]');
  assert.equal(await localLinks.count(), 2);
  const hrefs = await localLinks.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("href")),
  );
  assert.equal(new Set(hrefs).size, 2);
  await localLinks.first().click();
  await settle();
  await page
    .getByRole("link", { name: "Editar fechamento local", exact: true })
    .click();
  await settle();
  await page.getByRole("button", { name: "Continuar", exact: false }).click();
  await settle();
  await page.getByRole("button", { name: "Continuar", exact: false }).click();
  await settle();
  await page
    .getByRole("button", { name: "Conferir fechamento", exact: false })
    .click();
  await settle();
  await page
    .getByRole("button", { name: "Concluir simulação", exact: false })
    .click();
  await settle();
  await open("/caixa");
  assert.equal(
    await page.locator('a[href^="/caixa/historico/local-"]').count(),
    2,
  );
  pass(
    "Fechamentos da mesma data preservados; edição atualiza o registro e rascunho não é sobrescrito na retomada",
  );
  await open("/");
  assert.match(await text(), /653\.640,81/);
  await open("/mais");
  await page.getByRole("radio", { name: /Operação regular/ }).check();
  await page
    .getByRole("link", { name: "Explorar visão geral", exact: false })
    .click();
  await settle();
  await page.locator('a[href="/indicadores/cmv"]').click();
  await settle();
  await page.getByRole("link", { name: /Carnes/ }).click();
  await settle();
  assert.match(await page.locator(".detail-hero").innerText(), /18\.430,00/);
  assert.match(
    await page.locator(".detail-hero").innerText(),
    /10,0% do faturamento geral/,
  );
  await open("/mais");
  await page.getByRole("radio", { name: /Ainda sem dados/ }).check();
  await page
    .getByRole("link", { name: "Explorar visão geral", exact: false })
    .click();
  await settle();
  assert.match(await text(), /Ainda não há dados/);
  pass(
    "Recorte de compras usa percentual correspondente; cenário vazio permanece sem valores",
  );
  await open("/mais");
  await page
    .getByRole("radio", { name: "Histórico real", exact: false })
    .check();
  const routes = [
    "/",
    "/indicadores/faturamento",
    "/indicadores/faturamento/buffet",
    "/caixa",
    "/caixa/vendas",
    "/compras/cmv",
    "/caixa/historico/real-01",
    "/simulacao",
  ];
  for (const width of [320, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of routes) {
      await open(route);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `overflow ${route} ${width}`,
      );
    }
    await open("/");
    if (width === 1440)
      assert.ok((await page.locator("main").boundingBox()).width > 800);
    await page.screenshot({
      path: `artifacts/dashboard-${width}.png`,
      fullPage: true,
    });
  }
  pass("Navegação e ausência de overflow em 320/390/430px e desktop");
  const stored = await page.evaluate(() =>
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("danielli-demo-v2:"))
      .map((k) => sessionStorage.getItem(k))
      .join(""),
  );
  assert.doesNotMatch(stored, /65364081|drive\.google\.com/);
  await page.evaluate(() => {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("danielli-demo-v2:")) sessionStorage.removeItem(key);
  });
  await context.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("armazenamento indisponível");
    };
  });
  await open("/caixa/vendas");
  await page.getByLabel("Balcão", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Confirmar valores", exact: false })
    .click();
  await settle();
  await page.locator("#unit-confirmed-title").waitFor();
  assert.match(await text(), /Armazenamento indisponível/);
  pass(
    "Falha de armazenamento mantém a simulação em memória e informa o limite; livro real não é persistido nas simulações",
  );
  assert.deepEqual(failures, []);
  writeFileSync(
    "artifacts/ux-results.json",
    JSON.stringify({ results, failures }, null, 2),
  );
} catch (error) {
  await page
    .screenshot({ path: "artifacts/failure.png", fullPage: true })
    .catch(() => {});
  console.log(
    await page.locator(".filter-check").evaluateAll((nodes) =>
      nodes.map((n) => ({
        rect: n.getBoundingClientRect().toJSON(),
        html: n.outerHTML,
      })),
    ),
  );
  throw error;
} finally {
  await browser.close();
}
