import { test } from "node:test";
import assert from "node:assert/strict";
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
        sum(entries.filter((e) => e.group === g).map((e) => e.amount)),
      ),
    ),
    t.revenue,
  );
});
test("ausência de dados não produz percentuais ou Prime Cost reais", () => {
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
    "99999999999999",
  ])
    assert.equal(cents(input), null);
  const d = emptyDraft();
  d.sales = "0,30";
  d.receipts.Dinheiro = "0,10";
  d.receipts.Pix = "0,20";
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
