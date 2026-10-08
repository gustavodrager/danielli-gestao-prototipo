import { useSearchParams } from "react-router-dom";
import { availableMonths, currentMonth, type Period } from "./months";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import {
  emptyDraft,
  periodEntries,
  type CashDraft,
  type Scenario,
} from "./data";
import {
  paymentMethods,
  emptyUnitSales,
  defaultRates,
  ratesToDraft,
  upgradeUnitSalesDraft,
  type FeeDraft,
  type UnitSalesRecord,
} from "./unit-sales";
import { type PrototypeProfile } from "./prototype-views";
import { emptyPurchase, type PurchaseRecord } from "./purchase-input";
import { useLocalState, upsertByDate } from "./local-state";
import { emptyExpenseDrafts, type ExpenseRecord } from "./expense-input";
function useDemoState() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("mes") as Period | null;
  const period =
    requested && availableMonths().includes(requested)
      ? requested
      : currentMonth();
  const setPeriod = (next: Period) => {
    setParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set("mes", next);
      for (const key of ["dia", "busca", "pendencias"]) updated.delete(key);
      return updated;
    });
  };
  const [scenarioMode, setScenarioState] = useState<Scenario>("regular");
  const scenario: Scenario = period === "2026-07" ? "real" : scenarioMode;
  const setScenario = (next: Scenario) => {
    setScenarioState(next === "real" ? "regular" : next);
    if (next === "real") setPeriod("2026-07");
  };
  const [draft, setDraft, cashSaved] = useLocalState<CashDraft>(
    "cash-draft",
    emptyDraft,
  );
  const [closed, setClosed, closedSaved] = useLocalState<CashDraft | null>(
    "closed",
    null,
  );
  const [profile, setProfile] = useState<PrototypeProfile>(() =>
    window.location.pathname === "/caixa/vendas"
      ? "caixa"
      : window.location.pathname === "/compras/cmv"
        ? "compras"
        : "gestor",
  );
  const [feeRates, setFeeRates, ratesSaved] = useLocalState<FeeDraft>(
    "fee-rates",
    defaultRates,
  );
  const [unitSalesDraft, setUnitSalesDraft, salesSaved] = useLocalState(
    "sales-draft",
    () => emptyUnitSales(feeRates),
    upgradeUnitSalesDraft,
  );
  const [unitSalesRecord, setUnitSalesRecordState, salesRecordSaved] =
    useLocalState<UnitSalesRecord | null>("sales-record", null);
  const [feePresetApplied, setFeePresetApplied, feePresetSaved] = useLocalState(
    "fee-preset-2026-10-07",
    false,
  );
  useEffect(() => {
    if (feePresetApplied) return;
    setFeeRates(defaultRates());
    // Aplicar os percentuais solicitados uma vez, preservando registros confirmados.
    if (!unitSalesRecord)
      setUnitSalesDraft((current) => ({ ...current, rates: defaultRates() }));
    setFeePresetApplied(true);
  }, [
    feePresetApplied,
    setFeePresetApplied,
    setFeeRates,
    setUnitSalesDraft,
    unitSalesRecord,
  ]);
  const [purchaseDraft, setPurchaseDraft, purchaseSaved] = useLocalState(
    "purchase-draft",
    emptyPurchase,
  );
  const [purchaseRecord, setPurchaseRecordState, purchaseRecordSaved] =
    useLocalState<PurchaseRecord | null>("purchase-record", null);
  const [unitSalesRecords, setUnitSalesRecords, salesHistorySaved] =
    useLocalState<UnitSalesRecord[]>("sales-history", []);
  const [purchaseRecords, setPurchaseRecords, purchaseHistorySaved] =
    useLocalState<PurchaseRecord[]>("purchase-history", []);
  const [cashRecords, setCashRecords, cashHistorySaved] = useLocalState<
    CashDraft[]
  >("cash-history", []);
  const [expenseDrafts, setExpenseDrafts, expenseDraftsSaved] = useLocalState(
    "expense-drafts",
    emptyExpenseDrafts,
  );
  const [expenseRecords, setExpenseRecords, expenseRecordsSaved] =
    useLocalState<ExpenseRecord[]>("expense-history", []);
  const setUnitSalesRecord = (unitSalesRecord: UnitSalesRecord | null) => {
    setUnitSalesRecordState(unitSalesRecord);
    if (!unitSalesRecord) return;
    if (unitSalesRecord.rates) setFeeRates(ratesToDraft(unitSalesRecord.rates));
    setUnitSalesRecords((current) => upsertByDate(current, unitSalesRecord));
    setDraft((current) =>
      current.date === unitSalesRecord.date
        ? {
            ...current,
            units: Object.fromEntries(
              Object.entries(unitSalesRecord.values).map(([id, v]) => [
                id,
                v === null ||
                (unitSalesRecord.receipts &&
                  paymentMethods.some(
                    (m) =>
                      unitSalesRecord.receipts![
                        id as keyof typeof unitSalesRecord.receipts
                      ][m.id] === null,
                  ))
                  ? ""
                  : (v / 100).toFixed(2),
              ]),
            ),
          }
        : current,
    );
  };
  const setPurchaseRecord = (purchaseRecord: PurchaseRecord | null) => {
    setPurchaseRecordState(purchaseRecord);
    if (purchaseRecord)
      setPurchaseRecords((current) => upsertByDate(current, purchaseRecord));
  };
  return {
    expenseDrafts,
    setExpenseDrafts,
    expenseRecords,
    setExpenseRecords,
    feeRates,
    unitSalesRecords,
    setUnitSalesRecords,
    purchaseRecords,
    setPurchaseRecords,
    cashRecords,
    setCashRecords,
    localSaved:
      expenseDraftsSaved &&
      expenseRecordsSaved &&
      ratesSaved &&
      feePresetSaved &&
      cashSaved &&
      salesSaved &&
      purchaseSaved &&
      closedSaved &&
      salesRecordSaved &&
      purchaseRecordSaved &&
      salesHistorySaved &&
      purchaseHistorySaved &&
      cashHistorySaved,
    period,
    setPeriod,
    scenario,
    setScenario,
    draft,
    setDraft,
    closed,
    setClosed,
    profile,
    setProfile,
    unitSalesDraft,
    setUnitSalesDraft,
    unitSalesRecord,
    setUnitSalesRecord,
    selectUnitSalesRecord: setUnitSalesRecordState,
    purchaseDraft,
    setPurchaseDraft,
    purchaseRecord,
    setPurchaseRecord,
    entries: periodEntries(period, scenario),
  };
}
const DemoContext = createContext<ReturnType<typeof useDemoState> | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const value = useDemoState();
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("DemoProvider necessário");
  return context;
}
