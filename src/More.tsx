import { Link } from "react-router-dom";
import { useDemo } from "./demo-context";
import { Badge, Icon, Note } from "./ui";
import { type Scenario } from "./data";
export default function More() {
  const { scenario, setScenario } = useDemo();
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
        <div className="section-title">
          <h2>Explore a demonstração</h2>
          <Icon name="spark" />
        </div>
        <p>Escolha uma situação fictícia para testar a experiência.</p>
        <fieldset className="scenario-picker">
          <legend className="sr-only">Cenário da demonstração</legend>
          {(
            [
              [
                "regular",
                "Operação regular",
                "Indicadores disponíveis e exemplo de caixa sem diferença.",
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
            <label className={scenario === id ? "selected" : ""} key={id}>
              <input
                type="radio"
                name="scenario"
                value={id}
                checked={scenario === id}
                onChange={() => setScenario(id as Scenario)}
              />
              <span>
                <b>{name}</b>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <Note>
          Trocar o cenário altera os exemplos disponíveis. Para manter suas
          edições, o rascunho do caixa só muda quando você toca em “Preencher
          exemplo fictício”.
        </Note>
        <Link className="primary" to="/">
          Explorar visão geral <Icon name="arrow" size={16} />
        </Link>
      </section>
      <section className="panel">
        <h2>Um roteiro para apresentar ao Higor</h2>
        <ol className="story-list">
          <li>
            <b>Enxergar o todo</b>
            <p>
              Abra setembro e leia faturamento, compras, despesas e resultado.
            </p>
            <Link to="/">Ir para os indicadores ↗</Link>
          </li>
          <li>
            <b>Entender a origem</b>
            <p>
              Toque em CMV, escolha Carnes, siga até a origem e abra o documento
              fictício.
            </p>
            <Link to="/indicadores/cmv">Explorar a composição ↗</Link>
          </li>
          <li>
            <b>Fechar o dia</b>
            <p>
              Abra o caixa, preencha o exemplo e altere um recebimento. Veja a
              diferença mudar.
            </p>
            <Link to="/caixa">Simular fechamento ↗</Link>
          </li>
        </ol>
      </section>
      <section className="panel" id="qualidade">
        <h2>O que cada número significa</h2>
        <div className="quality-row">
          <Badge kind="observado" />
          <p>
            Valor transcrito de um registro. Nesta demonstração, todos os
            registros são fictícios.
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
          Compras aproximam o CMV nesta demonstração. O resultado e o CMV + Pessoal
          herdam essa estimativa. Médias diárias usam dias calendário, sem
          presumir dias de funcionamento.
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
        da diferença de caixa e tratamento das saídas, responsáveis e critérios
        de conferência.
      </Note>
    </>
  );
}
