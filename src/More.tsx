import { Link } from "./navigation";
import { useDemo } from "./demo-context";
import { Badge, Icon, Note, PrototypeViews } from "./ui";
import { type Scenario } from "./data";
import { storagePrefix } from "./local-state";
import { SourceNote } from "./Real";
export default function More() {
  const { scenario, setScenario, setProfile, setPeriod, period } = useDemo();
  return (
    <>
      <span className="eyebrow">DANIELLI GESTÃO</span>
      <h1>
        O próximo passo,
        <br />
        <em>no seu ritmo.</em>
      </h1>
      <p>
        Primeiro representar o que já existe. Depois, evoluir com o que os dados
        mostrarem.
      </p>
      <section className="panel">
        <h2>Visões do protótipo</h2>
        <PrototypeViews />
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>Escolha os dados da experiência</h2>
          <Icon name="spark" />
        </div>
        <p>
          Escolha o mês na visão geral. Julho preserva o livro real; os outros
          meses permitem explorar a gestão com dados fictícios.
        </p>
        <fieldset className="scenario-picker">
          <legend className="sr-only">Cenário da demonstração</legend>
          {(
            [
              [
                "regular",
                "Histórico por mês",
                "Julho usa o livro real; os outros meses usam registros fictícios identificados.",
              ],
              [
                "diferenca",
                "Diferença no caixa",
                "Exemplo com R$ 32,00 a menos nos recebimentos.",
              ],
              [
                "vazio",
                "Ainda sem dados",
                "Indicadores e histórico aguardando importação.",
              ],
            ] as const
          ).map(([id, name, description]) => (
            <label
              className={
                scenario === id || (id === "regular" && scenario === "real")
                  ? "selected"
                  : ""
              }
              key={id}
            >
              <input
                type="radio"
                disabled={period === "2026-07" && id !== "regular"}
                name="scenario"
                value={id}
                checked={
                  scenario === id || (id === "regular" && scenario === "real")
                }
                onChange={() => setScenario(id as Scenario)}
              />
              <span>
                <b>{name}</b>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {period === "2026-07" ? (
          <p className="hint">
            Julho mantém o livro real. Cenários alternativos ficam disponíveis
            nos meses fictícios.
          </p>
        ) : null}
        <button
          type="button"
          className="secondary unit-new"
          onClick={() => {
            setScenario("regular");
            setPeriod("2026-07");
          }}
        >
          Selecionar julho real
        </button>
        <Note>
          Dados reais e fictícios aparecem em meses identificados. Para manter
          suas edições, o rascunho do caixa só muda quando você toca em
          “Preencher exemplo fictício”.
        </Note>
        <Link className="primary" to="/" onClick={() => setProfile("gestor")}>
          Explorar visão geral <Icon name="arrow" size={16} />
        </Link>
      </section>
      <section className="panel" id="local">
        <h2>Simulações desta aba</h2>
        <p>
          Rascunhos e registros recuperáveis ao recarregar esta aba. Sem envio
          ao servidor. O navegador pode restaurar a sessão; apague os dados ao
          terminar em um dispositivo compartilhado.
        </p>
        <Link className="primary" to="/simulacao">
          Acompanhar registros locais
        </Link>
        <button
          className="secondary unit-new"
          onClick={() => {
            for (const key of Object.keys(sessionStorage))
              if (key.startsWith(storagePrefix)) sessionStorage.removeItem(key);
            window.location.assign("/caixa/vendas");
          }}
        >
          Apagar todos os dados da simulação nesta aba
        </button>
      </section>
      <section className="panel">
        <h2>Um roteiro para apresentar ao Higor</h2>
        <ol className="story-list">
          <li>
            <b>Enxergar o todo</b>
            <p>
              Comece em julho real: consulte as vendas, os recebimentos e as
              pendências do livro. Para compras e resultado, selecione o cenário
              fictício em setembro.
            </p>
            <Link to="/">Ir para os indicadores ↗</Link>
          </li>
          <li>
            <b>Entender a origem</b>
            <p>
              No histórico real, abra um dia e siga até a foto original no
              Drive. No cenário fictício, explore compras até o documento de
              exemplo.
            </p>
            <Link
              to={
                scenario === "real"
                  ? "/indicadores/faturamento"
                  : "/indicadores/cmv"
              }
            >
              Explorar a composição ↗
            </Link>
          </li>
          <li>
            <b>Fechar o dia</b>
            <p>
              Escolha uma unidade, informe os recebimentos, confira as taxas e
              revise o resumo antes de confirmar.
            </p>
            <Link to="/caixa/vendas">Informar recebimentos por unidade ↗</Link>
          </li>
        </ol>
      </section>
      <section className="panel" id="qualidade">
        <h2>O que cada número significa</h2>
        <SourceNote />
        <div className="quality-row">
          <Badge kind="observado" />
          <p>
            Valor escrito em um registro. Julho vem das fotos reais do livro; a
            transcrição ainda deve ser conferida. Os outros cenários são
            identificados como fictícios.
          </p>
        </div>
        <div className="quality-row">
          <Badge kind="calculado" />
          <p>Soma, média ou percentual derivado dos registros disponíveis.</p>
        </div>
        <div className="quality-row">
          <Badge kind="estimado" />
          <p>
            Depende de uma aproximação ou de dados incompletos. Não equivale a
            um valor real confirmado.
          </p>
        </div>
        <Note>
          No cenário fictício, compras aproximam o CMV. Resultado e CMV +
          Pessoal herdam essa estimativa. No histórico real, esses indicadores
          aguardam fontes suficientes. Nenhuma lacuna é preenchida com
          estimativa silenciosa.
        </Note>
      </section>
      <section className="panel">
        <h2>Implantação gradual</h2>
        <ol className="roadmap">
          <li>
            <span>01</span>
            <div>
              <b>Histórico e visão gerencial</b>
              <p>Organizar fotos, livros, notas, planilhas e relatórios.</p>
              <small>Foco inicial</small>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <b>Caixa no sistema</b>
              <p>
                Primeira área com entrada direta, preservando o fechamento
                atual.
              </p>
              <small>Próxima etapa · protótipo disponível</small>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <b>Digitalizar outras rotinas</b>
              <p>
                Compras, despesas e pessoas, conforme a operação estiver pronta.
              </p>
              <small>Evolução futura</small>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <b>Aprofundar a gestão</b>
              <p>
                Estoque, CMV real, conciliação, metas e integrações quando
                fizerem sentido.
              </p>
              <small>Possibilidades futuras</small>
            </div>
          </li>
        </ol>
      </section>
      <Note>
        <b>Para validar com Higor:</b> relação das unidades com as cores das
        comandas, categorias atuais de compras, composição de pessoal, fórmula
        da diferença de caixa e tratamento das saídas, referência de faturamento
        entre vendas e registrado, demais descrições do livro, responsáveis e
        critérios de conferência. Almoço → Buffet, Marmitex → Marmita e Lojista
        → Vitrine já estão confirmados.
      </Note>
    </>
  );
}
