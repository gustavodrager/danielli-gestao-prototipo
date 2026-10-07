import { Route, Routes } from "react-router-dom";
import { DemoProvider } from "./demo-context";
import { Shell, Back } from "./ui";
import Dashboard from "./Dashboard";
import { Indicator, EntryDetail, DailyDetail } from "./Indicator";
import { Cash, CashFlow, CashHistory, CashSuccess } from "./Cash";
import More from "./More";
import UnitSales from "./UnitSales";
import PurchaseInput from "./PurchaseInput";
import Simulation from "./Simulation";
export default function App() {
  return (
    <DemoProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dias/:date" element={<DailyDetail />} />
          <Route path="/simulacao" element={<Simulation />} />
          <Route path="/indicadores/:tipo" element={<Indicator />} />
          <Route path="/indicadores/:tipo/:grupo" element={<Indicator />} />
          <Route
            path="/indicadores/:tipo/:grupo/origens/:origem"
            element={<Indicator />}
          />
          <Route path="/lancamentos/:id" element={<EntryDetail />} />
          <Route path="/caixa" element={<Cash />} />
          <Route path="/caixa/vendas" element={<UnitSales />} />
          <Route path="/compras/cmv" element={<PurchaseInput />} />
          <Route path="/caixa/novo" element={<CashFlow step={1} />} />
          <Route path="/caixa/novo/unidades" element={<CashFlow step={2} />} />
          <Route path="/caixa/novo/saidas" element={<CashFlow step={3} />} />
          <Route
            path="/caixa/novo/conferencia"
            element={<CashFlow step={4} />}
          />
          <Route path="/caixa/concluido" element={<CashSuccess />} />
          <Route path="/caixa/historico/:id" element={<CashHistory />} />
          <Route path="/mais" element={<More />} />
          <Route
            path="*"
            element={
              <>
                <Back to="/">Visão geral</Back>
                <h1>Página não encontrada</h1>
                <p>Continue pela visão geral ou pelo Caixa.</p>
              </>
            }
          />
        </Routes>
      </Shell>
    </DemoProvider>
  );
}
