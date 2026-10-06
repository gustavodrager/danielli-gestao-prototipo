import assert from "node:assert/strict";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const bin = process.env.AGENT_BROWSER_BIN || "agent-browser";
const base = process.env.BASE_URL || "http://127.0.0.1:5173";
const evidence = [];
mkdirSync("artifacts", { recursive: true });
function run(...args) {
  if (args[0] === "screenshot") args[1] = resolve(args[1]);
  const result = spawnSync(bin, args, { encoding: "utf8", timeout: 40000 });
  assert.equal(
    result.status,
    0,
    `${args[0]}: ${result.stderr || result.stdout}`,
  );
  return result.stdout.trim();
}
function snapshot() {
  return run("snapshot", "-i");
}
function open(path) {
  run("open", base + path);
  snapshot();
}
function click(role, name) {
  snapshot();
  run("find", "role", role, "click", "--name", name);
  snapshot();
}
function fill(label, value) {
  run("find", "label", label, "fill", value);
  snapshot();
}
function check(expression) {
  assert.match(run("eval", `Boolean(${expression})`), /true/, expression);
}
function passed(name) {
  evidence.push(name);
  console.log(`PASS ${name}`);
}
run("set", "viewport", "390", "844");
open("/");
check("document.body.innerText.includes('184.320,00')");
check("scrollY === 0");
run("select", "select", "2026-08");
snapshot();
run("click", 'a[href="/indicadores/faturamento"]');
snapshot();
check("document.querySelector('select').value === '2026-08'");
check(
  "document.body.innerText.includes('Comanda amarela') && !document.body.innerText.includes('Carnes')",
);
click("link", "Visão geral");
run("select", "select", "2026-07");
snapshot();
check(
  "document.body.innerText.includes('Ainda não há dados') && !document.body.innerText.includes('R$ 0,00')",
);
click("button", "Explorar setembro de exemplo");
passed("Período preservado no drill-down; ausência de dados não vira zero");
run("click", 'a[href="/indicadores/cmv"]');
snapshot();
click("link", "Carnes");
click("link", "Fornecedor exemplo A");
click("link", "DEMO-CARNES-1");
run("click", "summary");
snapshot();
check(
  "document.querySelector('details').open && document.body.innerText.includes('FICTÍCIO')",
);
run("screenshot", "artifacts/documento-mobile.png");
passed("Resumo → categoria → origem → lançamento → documento fictício");
click("link", "Visão geral");
click("link", "Explorar o caixa");
click("link", "Iniciar fechamento");
click("button", "Continuar");
check(
  "document.querySelector('[role=alert]') !== null && location.pathname === '/caixa/novo'",
);
click("button", "Preencher exemplo fictício");
fill("Pix", "-1");
click("button", "Continuar");
check(
  "document.querySelector('[aria-invalid=true]') !== null && location.pathname === '/caixa/novo'",
);
fill("Pix", "3000,00");
check("document.querySelector('.total-strip').innerText.includes('8.970,00')");
click("link", "Sair e manter rascunho nesta sessão");
click("link", "Continuar rascunho");
check("document.querySelector('input[aria-label=Pix]').value === '3000,00'");
click("button", "Continuar");
check("document.body.innerText.includes('8.870,00')");
fill("Comanda azul", "1000,00");
check("document.body.innerText.includes('difere das vendas')");
fill("Comanda azul", "2640,00");
click("button", "Continuar");
click("button", "Remover saída 1");
click("button", "+ Adicionar saída");
click("button", "Conferir fechamento");
check(
  "document.querySelector('[role=alert]') !== null && location.pathname.endsWith('/saidas')",
);
fill("Descrição / referência do documento", "Recibo fictício de teste");
fill("Valor da saída 1", "120,00");
click("button", "Conferir fechamento");
check("document.querySelector('.difference').innerText.includes('100,00')");
run("screenshot", "artifacts/conferencia-mobile.png", "--full");
click("link", "Editar recebimentos");
fill("Pix", "2900,00");
click("button", "Continuar");
click("button", "Continuar");
click("button", "Conferir fechamento");
check("document.querySelector('.difference').innerText.includes('0,00')");
click("button", "Concluir simulação");
check(
  "location.pathname === '/caixa/concluido' && document.body.innerText.includes('SIMULAÇÃO CONCLUÍDA')",
);
passed(
  "Caixa: validação, rascunho, edição, comandas, saídas, retorno e conclusão",
);
click("link", "Mais");
run("find", "label", "Diferença no caixa", "check");
snapshot();
click("link", "Simular fechamento");
click("button", "Preparar nova simulação");
click("link", "Iniciar fechamento");
click("button", "Preencher exemplo fictício com diferença");
click("button", "Continuar");
click("button", "Continuar");
click("button", "Conferir fechamento");
check(
  "document.querySelector('.difference').innerText.includes('32,00') && document.querySelector('.difference').classList.contains('warning')",
);
click("button", "Concluir simulação");
passed("Cenário com diferença: sinalização sem inventar bloqueio operacional");
click("link", "Mais");
run("find", "label", "Ainda sem dados", "check");
snapshot();
click("link", "Explorar visão geral");
check("document.body.innerText.includes('Ainda não há dados')");
click("button", "Explorar setembro de exemplo");
passed("Troca de cenários e recuperação do estado vazio");
for (const width of [320, 375, 390, 430, 1024]) {
  run("set", "viewport", String(width), "844");
  for (const path of [
    "/",
    "/indicadores/faturamento",
    "/indicadores/cmv",
    "/indicadores/resultado",
    "/indicadores/prime-cost",
    "/caixa",
    "/caixa/novo",
    "/caixa/novo/unidades",
    "/caixa/novo/saidas",
    "/caixa/novo/conferencia",
    "/caixa/historico/03",
    "/mais",
  ]) {
    open(path);
    check("document.documentElement.scrollWidth <= innerWidth");
    check("!document.querySelector('vite-error-overlay')");
  }
  open("/");
  run("screenshot", `artifacts/dashboard-${width}.png`, "--full");
}
passed("Sem overflow horizontal em 12 rotas × 5 larguras (320–1024 px)");
run("set", "viewport", "390", "844");
for (const path of ["/", "/caixa/novo", "/mais"]) {
  open(path);
  const audit = run("a11y", "--json");
  writeFileSync(
    `artifacts/a11y-${path === "/" ? "dashboard" : path.split("/").pop()}.json`,
    audit,
  );
  const parsed = JSON.parse(audit);
  const violations =
    parsed.violations ?? parsed.data?.violations ?? parsed.result?.violations;
  assert.ok(
    Array.isArray(violations),
    "Formato inesperado no relatório de acessibilidade",
  );
  assert.equal(violations.length, 0, JSON.stringify(violations));
}
passed(
  "Acessibilidade automatizada: dashboard, recebimentos e Mais sem violações",
);
open("/nao-existe");
check("document.body.innerText.includes('Página não encontrada')");
open("/caixa/novo/conferencia");
click("button", "Concluir simulação");
check("document.querySelector('[role=alert]') !== null");
passed("Rotas inválidas e conferência aberta sem rascunho tratadas");
const errors = run("errors");
assert.equal(errors, "", errors);
open("/");
run("screenshot", "artifacts/dashboard-mobile.png");
writeFileSync(
  "artifacts/ui-check.json",
  JSON.stringify({ base, evidence, browserErrors: errors }, null, 2),
);
console.log("UI verification complete");
