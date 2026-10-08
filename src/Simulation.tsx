import SpendingSummary from "./SpendingSummary";
import { Link } from "./navigation";
import { useDemo } from "./demo-context";
import { dateLabel, money, units } from "./data";
import { Icon, Badge, Note } from "./ui";
import { recordToDraft } from "./unit-sales";
import { useState } from "react";
export default function Simulation() {
  const {
    unitSalesRecords,
    purchaseRecords,
    cashRecords,
    setProfile,
    setUnitSalesDraft,
    selectUnitSalesRecord,
    setPurchaseDraft,
    setPurchaseRecord,
  } = useDemo();
  const [month, setMonth] = useState(
    new Date()
      .toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
      .slice(0, 7),
  );
  const sales = unitSalesRecords.filter((r) => r.date.startsWith(month));
  const purchases = purchaseRecords.filter((r) => r.date.startsWith(month));
  const sumSales = sales.reduce((n, r) => n + r.total, 0);
  const sumPurchases = purchases.reduce((n, r) => n + r.amount, 0);
  return (
    <>
      <Link className="back" to="/" onClick={() => setProfile("gestor")}>
        <Icon name="back" size={17} />
        Visão gerencial
      </Link>
      <h1>Registros da simulação</h1>
      <Note>
        Dados digitados nesta aba, separados do histórico real e dos exemplos
        prontos. Sem envio ao servidor.
      </Note>
      <label className="text-field">
        Período
        <input
          type="month"
          value={month}
          onInput={(e) => setMonth(e.currentTarget.value)}
        />
      </label>
      <section className="detail-hero">
        <span>Vendas brutas informadas · {month}</span>
        <strong>
          {sales.length ? money(sumSales / 100) : "Não informado"}
        </strong>
        <Badge kind="calculado" />
        <span>
          {sales.length} dias ·{" "}
          {sales.filter((r) => r.completeCount === 6).length} com recebimentos
          completos nas seis unidades · cobertura dos dias do mês não confirmada
        </span>
      </section>
      <details className="panel">
        <summary>Vendas · composição e registros</summary>
        {units.map((u) => {
          const known = sales.filter((r) => r.values[u.id] !== null);
          return (
            <div className="summary-row" key={u.id}>
              <span>
                {u.name} · {known.length}/{sales.length} dias registrados
              </span>
              <b>
                {known.length
                  ? money(
                      known.reduce((n, r) => n + (r.values[u.id] ?? 0), 0) /
                        100,
                    )
                  : "Não informado"}
              </b>
            </div>
          );
        })}
        <p className="hint">
          Coberturas diferentes não formam um mix completo.
        </p>
        {sales.map((r) => (
          <Link
            className="row-link"
            key={r.date}
            to="/caixa/vendas"
            onClick={() => {
              setProfile("caixa");
              selectUnitSalesRecord(r);
              setUnitSalesDraft(recordToDraft(r));
            }}
          >
            {dateLabel(r.date)} · {money(r.total / 100)} bruto ·{" "}
            {r.receipts
              ? `${r.completeCount ?? 0}/6 completas · Conferir / editar`
              : "Sem detalhamento por recebimento"}
          </Link>
        ))}
      </details>
      <section className="panel">
        <h2>Taxas e líquido dos registros locais</h2>
        <div className="summary-row">
          <span>Taxas conhecidas</span>
          <b>
            {sales.some((r) => r.partialFees != null)
              ? money(sales.reduce((n, r) => n + (r.partialFees ?? 0), 0) / 100)
              : "A conferir"}
          </b>
        </div>
        <div className="summary-row">
          <span>
            {sales.length && sales.every((r) => r.netTotal != null)
              ? "Líquido após taxas"
              : "Líquido parcial · unidades calculáveis"}
          </span>
          <b>
            {sales.some((r) => r.partialNet != null)
              ? money(sales.reduce((n, r) => n + (r.partialNet ?? 0), 0) / 100)
              : "A conferir"}
          </b>
        </div>
        <p className="hint">
          {sales.reduce((n, r) => n + (r.netCount ?? 0), 0)}/{sales.length * 6}{" "}
          unidades/dia com líquido calculável. Não representa lucro; registros
          antigos e recebimentos ausentes não recebem taxas presumidas.
        </p>
      </section>
      <section className="detail-hero">
        <span>Soma das compras informadas · {month}</span>
        <strong>
          {purchases.length ? money(sumPurchases / 100) : "Não informado"}
        </strong>
        <Badge kind="calculado" />
        <span>
          {purchases.length} dias registrados · total observado por dia
        </span>
      </section>
      <p className="hint">
        Compras aproximam CMV. Sem estoque inicial/final, não calculamos CMV
        real ou resultado. Estes totais não sustentam detalhamento por
        fornecedor ou documento.
      </p>
      <details className="panel">
        <summary>Compras · registros</summary>
        {purchases.map((r) => (
          <Link
            className="row-link"
            key={r.date}
            to="/compras/cmv"
            onClick={() => {
              setProfile("compras");
              setPurchaseRecord(null);
              setPurchaseDraft({
                date: r.date,
                amount: (r.amount / 100).toFixed(2),
                reference: r.reference,
              });
            }}
          >
            {dateLabel(r.date)} · {money(r.amount / 100)} ·{" "}
            {r.reference || "Sem referência"} · Editar
          </Link>
        ))}
      </details>
      <SpendingSummary month={month} />
      <section className="panel">
        <h2>Caixa e conferência</h2>
        {cashRecords
          .filter((r) => r.date.startsWith(month))
          .map((r) => (
            <Link
              className="row-link"
              key={r.localId}
              to={`/caixa/historico/local-${r.localId}`}
            >
              {dateLabel(r.date)} · Consultar fechamento local
            </Link>
          ))}
        {!cashRecords.length && <p>Nenhum fechamento concluído.</p>}
      </section>
      <Link className="secondary" to="/mais#local">
        Gerenciar dados desta aba
      </Link>
    </>
  );
}
