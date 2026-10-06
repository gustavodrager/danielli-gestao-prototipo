import { createContext, useContext, useState, type ReactNode } from "react";
import {
  emptyDraft,
  periodEntries,
  type CashDraft,
  type Period,
  type Scenario,
} from "./data";
function useDemoState() {
  const [period, setPeriod] = useState<Period>("2026-09");
  const [scenario, setScenario] = useState<Scenario>("regular");
  const [draft, setDraft] = useState<CashDraft>(emptyDraft);
  const [closed, setClosed] = useState<CashDraft | null>(null);
  return {
    period,
    setPeriod,
    scenario,
    setScenario,
    draft,
    setDraft,
    closed,
    setClosed,
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
