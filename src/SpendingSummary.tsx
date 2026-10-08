import { useDemo } from "./demo-context";
import { money } from "./data";
import { expenseKinds, expenseToDraft, expenseTotals } from "./expense-input";
import { Link } from "./navigation";

export default function SpendingSummary({ month }: { month: string }) {
  const { expenseRecords, purchaseRecords, setExpenseDrafts } = useDemo();
  const totals = expenseTotals(expenseRecords, month);
  const purchases = purchaseRecords.filter((r) => r.date.startsWith(month));
  const matching = expenseRecords.filter((r) => r.month === month);
  const format = (value: number | null) =>
    value === null ? "Não informado" : money(value / 100);
  return (
    <section className="panel spending-summary">
      <h2>Valores informados no mês</h2>
      <Link
        className="summary-row"
        to={`/compras/cmv?area=cmv&resumo=${month}`}
      >
        <span>Compras / CMV aproximado</span>
        <b>
          {format(
            purchases.length
              ? purchases.reduce((sum, r) => sum + r.amount, 0)
              : null,
          )}
        </b>
      </Link>
      <Link
        className="summary-row"
        to={`/compras/cmv?area=fixas&resumo=${month}`}
      >
        <span>Despesas fixas</span>
        <b>{format(totals.fixed)}</b>
      </Link>
      <Link
        className="summary-row"
        to={`/compras/cmv?area=variaveis&resumo=${month}`}
      >
        <span>Despesas variáveis</span>
        <b>{format(totals.variable)}</b>
      </Link>
      <div className="summary-row">
        <span>Pessoal · soma informada</span>
        <b>{format(totals.staff)}</b>
      </div>
      <Link
        className="summary-row staff-summary"
        to={`/compras/cmv?area=pessoal&resumo=${month}`}
      >
        <span>Equipe fixa</span>
        <b>{format(totals.staffFixed)}</b>
      </Link>
      <Link
        className="summary-row staff-summary"
        to={`/compras/cmv?area=pessoal&equipe=freela&resumo=${month}`}
      >
        <span>Equipe Extra</span>
        <b>{format(totals.staffFreela)}</b>
      </Link>
      <p className="hint">
        Simulação desta aba · somas calculadas sobre os registros informados,
        com cobertura ainda não confirmada. Pessoal aparece separado das demais
        despesas. Sem cálculo de resultado.
      </p>
      <details>
        <summary>Despesas e pessoal · {matching.length} lançamentos</summary>
        {!matching.length ? (
          <p>Nenhum lançamento neste mês.</p>
        ) : (
          matching.map((r) => {
            const kind = expenseKinds.find((k) => k.id === r.kind)!;
            return (
              <Link
                key={r.id}
                className="row-link"
                to={`/compras/cmv?area=${kind.area}&resumo=${month}${r.kind === "staff-freela" ? "&equipe=freela" : ""}`}
                onClick={() =>
                  setExpenseDrafts((current) => ({
                    ...current,
                    [r.kind]: expenseToDraft(r),
                  }))
                }
              >
                {kind.name} · {r.category || "Sem detalhamento"} ·{" "}
                {money(r.amount / 100)} · Editar
              </Link>
            );
          })
        )}
      </details>
    </section>
  );
}
