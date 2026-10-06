import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyPurchase,
  purchaseErrors,
  purchaseAmount,
} from "../src/purchase-input.ts";
import {
  emptyUnitSales,
  unitSalesSummary,
  unitSalesErrors,
} from "../src/unit-sales.ts";
import {
  realCash,
  realTotal,
  reconciliation,
  realUnitTotal,
  realUnitStatus,
} from "../src/real-data.ts";
import {
  cashErrors,
  cashTotals,
  cents,
  emptyDraft,
  entries,
  exampleDraft,
  periodEntries,
  sum,
  totals,
} from "../src/data.ts";
test("composição e resultado reconciliam com os lançamentos fictícios", () => {
  const t = totals(entries);
  assert.equal(t.revenue, 184320);
  assert.equal(t.purchases, 59710);
  assert.equal(t.expenses, 28450);
  assert.equal(t.staff, 41200);
  assert.equal(t.result, 54960);
  assert.equal(t.result + t.purchases + t.expenses + t.staff, t.revenue);
  const groups = [
    ...new Set(
      entries.filter((e) => e.metric === "faturamento").map((e) => e.group),
    ),
  ];
  assert.equal(
    sum(
      groups.map((g) =>
        sum(
          entries
            .filter((e) => e.metric === "faturamento" && e.group === g)
            .map((e) => e.amount),
        ),
      ),
    ),
    t.revenue,
  );
});
test("entrada de compras distingue ausência, zero, valor válido e inválido", () => {
  const draft = emptyPurchase();
  assert.equal(purchaseAmount(draft.amount), null);
  assert.ok(purchaseErrors(draft).length);
  draft.amount = "0,00";
  assert.equal(purchaseAmount(draft.amount), 0);
  assert.deepEqual(purchaseErrors(draft), []);
  draft.amount = "1.420,25";
  assert.equal(purchaseAmount(draft.amount), 142025);
  assert.deepEqual(purchaseErrors(draft), []);
  for (const raw of ["abc", "-1", "1,234", "R$"]) {
    draft.amount = raw;
    assert.equal(purchaseAmount(draft.amount), null);
    assert.ok(purchaseErrors(draft).length);
  }
  draft.amount = "100";
  draft.date = "2026-02-30";
  assert.ok(purchaseErrors(draft).some((e) => e.field === "purchase-date"));
});
test("entrada simples soma centavos e preserva unidades não informadas", () => {
  const draft = emptyUnitSales();
  draft.values.balcao = "0,10";
  draft.values.buffet = "0,20";
  const summary = unitSalesSummary(draft);
  assert.equal(summary.total, 30);
  assert.equal(summary.count, 2);
  assert.equal(summary.values.marmita, null);
  assert.deepEqual(unitSalesErrors(draft), []);
  draft.values.marmita = "0,00";
  assert.equal(unitSalesSummary(draft).values.marmita, 0);
  assert.equal(unitSalesSummary(draft).count, 3);
});
test("entrada simples não confirma campos vazios, inválidos ou datas inexistentes", () => {
  const draft = emptyUnitSales();
  assert.equal(unitSalesSummary(draft).total, null);
  assert.ok(unitSalesErrors(draft).length);
  draft.values.balcao = "0,00";
  assert.deepEqual(unitSalesErrors(draft), []);
  draft.date = "2026-02-30";
  assert.ok(unitSalesErrors(draft).some((e) => e.field === "unit-sales-date"));
  draft.date = "2024-02-29";
  assert.deepEqual(unitSalesErrors(draft), []);
  for (const value of ["-1", "abc", "1,234", "R$"]) {
    draft.values.buffet = value;
    assert.equal(unitSalesSummary(draft).total, null);
    assert.ok(
      unitSalesErrors(draft).some((e) => e.field === "unit-sales-buffet"),
    );
  }
});
test("ausência de dados não produz percentuais ou CMV + Pessoal reais", () => {
  assert.deepEqual(periodEntries("2026-07", "regular"), []);
  assert.deepEqual(periodEntries("2026-09", "vazio"), []);
  assert.equal(totals([]).primeCost, null);
  assert.equal(totals([]).cmvPercent, null);
  assert.ok(
    totals(periodEntries("2026-08", "regular")).revenue <
      totals(entries).revenue,
  );
});
test("valores monetários usam centavos e rejeitam entradas inválidas", () => {
  for (const [input, expected] of [
    ["1.420,00", 142000],
    ["R$ 1.420,00", 142000],
    ["0,10", 10],
    ["0.20", 20],
    ["1.420", 142000],
    ["", 0],
  ] as const)
    assert.equal(cents(input), expected);
  for (const input of [
    "-32",
    "abc",
    "1,234",
    "1.2.3,00",
    "Infinity",
    "R$ ",
    "99999999999999",
  ])
    assert.equal(cents(input), null);
  const d = emptyDraft();
  d.sales = "0,30";
  d.receipts.Dinheiro = "0,10";
  d.receipts.Pix = "0,20";
  assert.equal(cashTotals(d).difference, null);
  assert.equal(cashTotals(d).receiptCount, 2);
  for (const method of Object.keys(d.receipts))
    if (!d.receipts[method]) d.receipts[method] = "0";
  assert.equal(cashTotals(d).difference, 0);
});
test("a conferência usa as edições; saídas permanecem separadas", () => {
  const regular = exampleDraft("regular");
  assert.equal(cashTotals(regular).receipts, 887000);
  assert.equal(cashTotals(regular).difference, 0);
  assert.equal(cashTotals(regular).outflows, 12000);
  assert.equal(cashTotals(regular).mix, cashTotals(regular).sales);
  assert.equal(cashTotals(exampleDraft("diferenca")).difference, -3200);
  regular.receipts.Pix = "3000,00";
  assert.equal(cashTotals(regular).difference, 10000);
});
test("campos inválidos impedem confirmação, diferença por si só não bloqueia", () => {
  assert.ok(cashErrors(emptyDraft()).length);
  assert.deepEqual(cashErrors(exampleDraft("regular")), []);
  assert.deepEqual(cashErrors(exampleDraft("diferenca")), []);
  const draft = exampleDraft("regular");
  draft.outflows.push({ id: 2, description: "", amount: "10,00" });
  assert.ok(cashErrors(draft).some((e) => e.startsWith("Preencha")));
  draft.outflows.pop();
  draft.receipts.Pix = "-1";
  assert.ok(cashErrors(draft).some((e) => e.startsWith("Revise")));
});
test("histórico real preserva cobertura, centavos e pendências sem completar com exemplos", () => {
  assert.equal(realCash.length, 31);
  assert.equal(new Set(realCash.map((r) => r.date)).size, 31);
  assert.deepEqual(realTotal("vendas"), { cents: 65364081, count: 31 });
  assert.equal(realTotal("registrado").count, 30);
  assert.equal(realTotal("credito").count, 30);
  assert.equal(realCash[12].values.dinheiro, 0); // Zero explícito no livro.
  assert.equal(realCash[24].values.registrado, null); // Rasura não vira valor inferido.
  assert.equal(realCash[28].values.pix, null); // Desfoque não vira zero.
  assert.equal(reconciliation(realCash[28]).receipts, null);
  assert.equal(reconciliation(realCash[17]).compositionGap, -10000);
  assert.equal(reconciliation(realCash[24]).compositionGap, -50);
  for (const r of realCash) {
    assert.ok(r.sourceUrl.startsWith("https://drive.google.com/file/d/"));
    for (const v of Object.values(r.values))
      assert.ok(v === null || Number.isSafeInteger(v));
    if (r.values.registrado !== null)
      assert.equal(reconciliation(r).difference, r.values.diferenca);
  }
  assert.deepEqual(periodEntries("2026-09", "real"), []);
  assert.deepEqual(realUnitTotal("buffet"), { cents: 29608713, count: 28 });
  assert.deepEqual(realUnitTotal("marmita"), { cents: 4337000, count: 25 });
  assert.deepEqual(realUnitTotal("vitrine"), { cents: 1798904, count: 21 });
  assert.equal(realCash[0].unitValues.buffet, 943621);
  assert.equal(realUnitStatus(realCash[4], "marmita"), "Sem valor anotado");
  assert.equal(realUnitStatus(realCash[28], "buffet"), "Leitura pendente");
});

test("recebimentos ausentes não produzem diferença conclusiva", () => {
  const draft = emptyDraft();
  draft.sales = "100";
  assert.equal(cashTotals(draft).receiptCount, 0);
  assert.equal(cashTotals(draft).difference, null);
  draft.receipts.Pix = "0";
  assert.equal(cashTotals(draft).receiptCount, 1);
  assert.equal(cashTotals(draft).difference, null);
  for (const method of Object.keys(draft.receipts))
    draft.receipts[method] = "0";
  assert.equal(cashTotals(draft).difference, -10000);
  draft.receipts.Pix = "inválido";
  assert.equal(cashTotals(draft).difference, null);
});
