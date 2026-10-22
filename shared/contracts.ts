import type {
  UnitSalesDraft,
  UnitSalesRecord,
  UnitPayments,
  FeeId,
  UnitId,
} from "../src/unit-sales.ts";

export type Role = "gestor" | "operador";
export type FeeRates = Record<FeeId, number | null>;
export interface AppUser {
  id: string;
  login: string;
  name: string;
  role: Role;
  active: boolean;
  defaultRates: FeeRates;
}
export interface SessionResponse {
  user: AppUser | null;
  csrfToken: string;
  today: string;
}
export interface StoredSale {
  id: string;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  record: UnitSalesRecord;
}
export interface SalesPayload {
  date: string;
  receipts: UnitPayments<number | null>;
  rates: FeeRates;
  expectedVersion: number | null;
  requestId: string;
}
export interface SavedDraft {
  date: string;
  version: number;
  baseVersion: number | null;
  draft: UnitSalesDraft;
  updatedAt: string;
}
export interface SaleRevision {
  version: number;
  actor: { id: string; name: string };
  createdAt: string;
  record: UnitSalesRecord;
}
export interface HistoricalCashRecord {
  id: string;
  date: string;
  page: number;
  file: string;
  sourceUrl: string;
  values: Record<
    | "pix"
    | "dinheiro"
    | "saidas"
    | "debito"
    | "credito"
    | "voucher"
    | "ifood"
    | "vendas"
    | "registrado"
    | "diferenca",
    number | null
  >;
  note: string;
  unitValues: Partial<Record<UnitId, number | null>>;
  unitPending: Partial<Record<UnitId, string>>;
}
export interface DashboardResponse {
  month: string;
  source: "operational" | "historical";
  sales: StoredSale[];
  historical: HistoricalCashRecord[];
}
export interface ApiErrorPayload {
  error: { code: string; message: string; details?: unknown };
}
