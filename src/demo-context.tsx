import { createContext, useContext, useState, type ReactNode } from "react";
import {
  emptyDraft,
  periodEntries,
  type CashDraft,
  type Period,
  type Scenario,
} from "./data";
import { emptyUnitSales, type UnitSalesRecord } from "./unit-sales";
import { type PrototypeProfile } from "./prototype-views";
import { emptyPurchase, type PurchaseRecord } from "./purchase-input";
import { useLocalState, upsertByDate } from "./local-state";
function useDemoState() {
  const [period, setPeriod] = useState<Period>("2026-07");
  const [scenario, setScenarioState] = useState<Scenario>("real");
  const setScenario = (next: Scenario) => {
    setScenarioState(next);
    setPeriod(next === "real" ? "2026-07" : "2026-09");
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
  const [unitSalesDraft, setUnitSalesDraft, salesSaved] = useLocalState(
    "sales-draft",
    emptyUnitSales,
  );
  const [unitSalesRecord, setUnitSalesRecordState, salesRecordSaved] =
    useLocalState<UnitSalesRecord | null>("sales-record", null);
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
  const setUnitSalesRecord = (unitSalesRecord: UnitSalesRecord | null) => {
    setUnitSalesRecordState(unitSalesRecord);
    if (!unitSalesRecord) return;
    setUnitSalesRecords((current) => upsertByDate(current, unitSalesRecord));
    setDraft((current) =>
      current.date === unitSalesRecord.date
        ? {
            ...current,
            units: Object.fromEntries(
              Object.entries(unitSalesRecord.values).map(([id, v]) => [
                id,
                v === null ? "" : (v / 100).toFixed(2),
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
    unitSalesRecords,
    setUnitSalesRecords,
    purchaseRecords,
    setPurchaseRecords,
    cashRecords,
    setCashRecords,
    localSaved:
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
