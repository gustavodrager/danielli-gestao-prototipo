import {
  availableMonths,
  currentMonth,
  daysCovered,
  previousMonth,
  todayInSaoPaulo,
  withMonth,
} from "../src/months.ts";
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
  makeUnitSalesRecord,
  recordToDraft,
  upgradeUnitSalesDraft,
  ratePoints,
  sharedReceipts,
  type UnitSalesRecord,
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
  mockEntries,
  units,
} from "../src/data.ts";
test("composição e resultado reconciliam com os lançamentos fictícios", () => {
  const t = totals(entries);
  assert.equal(
    entries.filter((e) => e.metric === "faturamento").length,
    6 * 30,
  );
  assert.equal(
    Math.round((t.result + t.purchases + t.expenses + t.staff) * 100),
    Math.round(t.revenue * 100),
  );
  const known = totals([
    { ...entries[0], metric: "faturamento", amount: 10000 },
    { ...entries[0], metric: "cmv", amount: 3000 },
    { ...entries[0], metric: "despesas", amount: 1200 },
    { ...entries[0], metric: "pessoal", amount: 2500 },
  ]);
  assert.equal(known.result, 3300);
  assert.equal(known.cmvPercent, 30);
  assert.ok(Math.abs(known.primeCost! - 55) < 1e-10);
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
  draft.receipts!.balcao.debito = "0,10";
  draft.receipts!.buffet.pix = "0,20";
  const summary = unitSalesSummary(draft);
  assert.equal(summary.total, 30);
  assert.equal(summary.count, 2);
  assert.equal(summary.values.marmita, null);
  assert.deepEqual(unitSalesErrors(draft), []);
  draft.receipts!.marmita.dinheiro = "0,00";
  assert.equal(unitSalesSummary(draft).values.marmita, 0);
  assert.equal(unitSalesSummary(draft).count, 3);
});
test("entrada simples não confirma campos vazios, inválidos ou datas inexistentes", () => {
  const draft = emptyUnitSales();
  assert.equal(unitSalesSummary(draft).total, null);
  assert.ok(unitSalesErrors(draft).length);
  draft.receipts!.balcao.debito = "0,00";
  assert.deepEqual(unitSalesErrors(draft), []);
  draft.date = "2026-02-30";
  assert.ok(unitSalesErrors(draft).some((e) => e.field === "unit-sales-date"));
  draft.date = "2024-02-29";
  assert.deepEqual(unitSalesErrors(draft), []);
  for (const value of ["-1", "abc", "1,234", "R$"]) {
    draft.receipts!.buffet.pix = value;
    assert.equal(unitSalesSummary(draft).total, null);
    assert.ok(
      unitSalesErrors(draft).some((e) => e.field === "unit-sales-buffet-pix"),
    );
  }
});
test("ausência de dados não produz percentuais ou CMV + Pessoal reais", () => {
  assert.deepEqual(periodEntries("2026-07", "regular"), []);
  assert.deepEqual(periodEntries("2026-09", "vazio"), []);
  assert.equal(totals([]).primeCost, null);
  assert.equal(totals([]).cmvPercent, null);
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
  assert.deepEqual(periodEntries("2026-07", "real"), []);
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

test("mês vigente usa São Paulo e calendário, inclusive mudança de ano", () => {
  assert.equal(todayInSaoPaulo(new Date("2027-01-01T01:00:00Z")), "2026-12-31");
  assert.equal(currentMonth(new Date("2027-01-01T04:00:00Z")), "2027-01");
  assert.equal(previousMonth("2027-01"), "2026-12");
  assert.equal(daysCovered("2026-05", "2026-10-07"), 31);
  assert.equal(daysCovered("2026-06", "2026-10-07"), 30);
  assert.equal(daysCovered("2026-10", "2026-10-07"), 7);
  assert.equal(daysCovered("2026-11", "2026-10-07"), 0);
  assert.equal(daysCovered("2028-02", "2028-03-01"), 29);
  assert.deepEqual(availableMonths("2026-10-07"), [
    "2026-05",
    "2026-06",
    "2026-07",
    "2026-08",
    "2026-09",
    "2026-10",
  ]);
  assert.equal(
    withMonth("/indicadores/cmv?dia=01#origem", "2026-06"),
    "/indicadores/cmv?dia=01&mes=2026-06#origem",
  );
});
test("exemplos diários são estáveis, reconciliáveis e nunca completam julho", () => {
  assert.equal(mockEntries("2026-07", "2026-10-07").length, 0);
  const first = mockEntries("2026-10", "2026-10-07"),
    next = mockEntries("2026-10", "2026-10-08");
  assert.equal(new Set(first.map((e) => e.date)).size, 7);
  assert.ok(first.every((e) => e.date <= "2026-10-07"));
  assert.deepEqual(
    first,
    next.filter((e) => e.date <= "2026-10-07"),
  );
  assert.equal(new Set(first.map((e) => e.id)).size, first.length);
  assert.equal(new Set(first.map((e) => e.document)).size, first.length);
  for (const day of new Set(first.map((e) => e.date))) {
    const daily = first.filter(
      (e) => e.date === day && e.metric === "faturamento",
    );
    assert.equal(daily.length, 6);
    assert.ok(daily.every((e) => e.document.startsWith("DEMO-")));
  }
  assert.equal(
    sum(first.filter((e) => e.metric === "faturamento").map((e) => e.amount)),
    totals(first).revenue,
  );
});
test("taxas e líquido preservam ausência, zero e arredondamento por unidade e método", () => {
  const d = emptyUnitSales();
  d.receipts!.balcao = {
    debito: "100",
    credito: "200",
    dinheiro: "50",
    pix: "150",
  };
  d.rates = { debito: "1,50", credito: "3,25", pix: "0,50" };
  let s = unitSalesSummary(d);
  assert.equal(s.total, 50000);
  assert.equal(s.completeCount, 1);
  assert.equal(s.partialFees, 875);
  assert.equal(s.partialNet, 49125);
  assert.equal(s.netTotal, null);
  assert.equal(s.netCount, 1);
  d.rates.pix = "";
  s = unitSalesSummary(d);
  assert.equal(s.partialNet, null);
  assert.equal(s.netCount, 0);
  d.receipts!.balcao.pix = "0";
  s = unitSalesSummary(d);
  assert.equal(s.partialFees, 800);
  assert.equal(s.partialNet, 34200);
  d.receipts!.balcao = {
    debito: "0,10",
    credito: "0,10",
    dinheiro: "0",
    pix: "0",
  };
  d.rates = { debito: "3", credito: "3", pix: "" };
  assert.equal(unitSalesSummary(d).partialFees, 0); // Dois descontos < meio centavo, arredondados antes da soma.
  for (const unit of units)
    d.receipts![unit.id] = {
      debito: "0",
      credito: "0",
      dinheiro: "0",
      pix: "0",
    };
  d.rates = { debito: "", credito: "", pix: "" };
  assert.equal(unitSalesSummary(d).netTotal, 0); // Nenhuma taxa necessária sobre base zero.
  assert.deepEqual(unitSalesErrors(d), []);
});
test("percentuais inválidos bloqueiam confirmação; confirmação parcial não inventa líquido", () => {
  for (const raw of ["-1", "100,01", "1,234", "abc", "R$"])
    assert.equal(ratePoints(raw), null);
  assert.equal(ratePoints("1,25"), 125);
  assert.equal(ratePoints("100"), 10000);
  assert.equal(ratePoints(""), null);
  const d = emptyUnitSales();
  d.receipts!.balcao.dinheiro = "10,50";
  let record = makeUnitSalesRecord(d);
  assert.equal(record.total, 1050);
  assert.equal(record.netTotal, null);
  assert.equal(record.receipts!.balcao.pix, null);
  d.rates!.debito = "101";
  assert.ok(unitSalesErrors(d).some((e) => e.field === "fee-debito"));
  assert.throws(() => makeUnitSalesRecord(d));
});
test("registros antigos mantêm seus totais sem distribuição e taxas ficam congeladas", () => {
  const legacy: UnitSalesRecord = {
    date: "2026-10-06",
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
  const migrated = upgradeUnitSalesDraft({
    date: legacy.date,
    values: recordToDraft(legacy).values,
  });
  assert.equal(migrated.values.balcao, "100.00");
  assert.equal(migrated.receipts!.balcao.debito, "");
  assert.equal(legacy.total, 10000);
  assert.equal(sharedReceipts(legacy), null);
  const editedLegacy = recordToDraft(legacy);
  editedLegacy.receipts!.balcao.dinheiro = "20";
  const updatedLegacy = makeUnitSalesRecord(editedLegacy);
  assert.equal(updatedLegacy.total, 2000);
  assert.deepEqual(updatedLegacy.legacyTotals, {
    values: legacy.values,
    total: legacy.total,
    count: legacy.count,
  });
  assert.deepEqual(
    recordToDraft(updatedLegacy).legacyTotals,
    updatedLegacy.legacyTotals,
  );
  editedLegacy.legacyTotals!.values.balcao = 1;
  assert.equal(updatedLegacy.legacyTotals!.values.balcao, 10000);
  const d = emptyUnitSales();
  d.receipts!.balcao = { debito: "100", credito: "0", dinheiro: "0", pix: "0" };
  d.rates!.debito = "1,50";
  const saved = makeUnitSalesRecord(d);
  d.rates!.debito = "5";
  assert.equal(saved.rates!.debito, 150);
  assert.equal(saved.partialNet, 9850);
  assert.equal(recordToDraft(saved).rates!.debito, "1,50");
  assert.equal(sharedReceipts(saved)!.debito, null); // As cinco unidades ausentes não viram zero.
  for (const u of units)
    d.receipts![u.id] = { debito: "1", credito: "0", dinheiro: "0", pix: "0" };
  assert.equal(sharedReceipts(makeUnitSalesRecord(d))!.debito, 600);
});
