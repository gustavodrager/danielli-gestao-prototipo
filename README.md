# Danielli Gestão — Protótipo UX/UI

Protótipo mobile-first do Restaurante e Doceria Danielli. As unidades atuais são **Balcão, Buffet, Massas, Churrasco, Marmita e Vitrine**. **Valores, fornecedores, responsáveis e documentos são fictícios.** A identidade visual é uma proposta para validação, sem substituir uma marca oficial.

## Experiência disponível

- Dashboard com período selecionável, comparação histórica, média por dia calendário, despesas, pessoal, mix por unidade, resultado e CMV + Pessoal.
- Drill-down: resumo → composição → categoria/unidade → fornecedor/origem → lançamento → documento demonstrativo.
- Caixa em quatro etapas: recebimentos e responsáveis → unidades de negócio → saídas e observações → conferência.
- Totais derivados dos campos digitados, validação de valores, retorno para edição, rascunho e conclusão **apenas na sessão atual**.
- Cenários em **Mais**: operação regular, diferença de caixa e ausência de dados.
- Roteiro de apresentação, explicação da qualidade dos dados e implantação gradual.
- Estados vazios, registros indisponíveis, rota desconhecida, formulário inválido e sucesso.

## Limites de negócio preservados

As seis unidades foram confirmadas pelo usuário. A relação de cada unidade com uma cor de comanda ainda precisa ser confirmada; o protótipo não atribui cores. Não há rateio de despesas/CMV por unidade.

Compras ilustram a aproximação do CMV. Sem estoques inicial/final, **CMV, resultado e CMV + Pessoal são estimados**. O resultado demonstrativo usa faturamento − compras − despesas gerais − pessoal. O CMV + Pessoal demonstrativo usa (compras + pessoal) / faturamento. Validar cobertura e metodologia com Higor antes de usar dados reais.

A diferença do caixa é **demonstrativa: soma dos recebimentos − vendas informadas**. Saídas ficam visíveis separadamente, sem abatimento automático. A fórmula oficial, os conceitos de total registrado/vendas e o tratamento das saídas precisam ser confirmados. Diferenças e falta de distribuição por unidade não criam bloqueios operacionais fictícios. Campos obrigatórios são validações da demonstração.

Os lançamentos de receita são resumos históricos agregados fictícios, não vendas individuais. A visualização de documentos é textual e marcada como fictícia; nenhuma foto real foi importada. Julho não possui dados e não aparece como faturamento zero.

Sem backend, upload, integração ou gravação permanente. Recarregar a página limpa cenário, período, rascunho e simulação concluída. Concluir o caixa não altera os indicadores históricos.

## Revisão de UX/UI

| Gap inicial                                      | Melhoria implementada                                                                     |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Botões sem ação e detalhamento genérico          | Destinos próprios para todos os indicadores, linhas e documentos                          |
| Faturamento detalhado em Carnes/Buffet/Massas    | Receita por unidade; compras por categoria, sem misturar conceitos                        |
| Período e “atualizado hoje” sem contexto         | Meses explícitos e histórico fictício, sem sugerir atualização real                       |
| Gráfico sem escala, rótulos ou origem            | Meses, valores, mês sem dados e descrição acessível                                       |
| Totais de caixa fixos, sem ligação ao formulário | Estado compartilhado, somas em centavos e conferência das edições                         |
| Responsáveis, saídas e conclusão ausentes        | Fluxo completo de demonstração com retorno e sucesso                                      |
| Estimativas apresentadas como reais              | Sinalização observado/calculado/estimado e explicação das fórmulas                        |
| Poucos estados e narrativa de apresentação       | Três cenários, estados vazios/erro e roteiro em Mais                                      |
| Acabamento genérico                              | Paleta creme/amarelo/dourado, hierarquia, foco visível, áreas de toque e navegação inferior |

## Executar e validar

Node.js 24, alinhado ao projeto na Vercel.

```bash
npm ci
npm run dev
npm run build
npm test
```

O teste do modelo verifica composição dos indicadores, ausência de dados, valores monetários, edições no caixa e validações.

Com `agent-browser` disponível no PATH e o servidor local iniciado:

```bash
npm run test:ui
```

Se necessário, informe `AGENT_BROWSER_BIN` com o caminho do executável. `BASE_URL` permite testar outra instância. O teste percorre drill-down, formulário, rascunho, edições, saídas, conferência, cenários, rotas indisponíveis, 12 rotas em larguras de 320/375/390/430/1024 px e auditoria automatizada de acessibilidade. Evidências ficam em `artifacts/`, ignorado pelo Git. Os testes são de simulação; não enviam dados à operação.

`vercel.json` permite abrir e recarregar diretamente as rotas da aplicação. O build gera `dist/`.

## Validar com Higor

1. Correspondência entre cada unidade confirmada e a cor da comanda.
2. Categorias atuais de compras, despesas e composição de pessoal, evitando duplicidade de despesas.
3. Metodologia do CMV, resultado gerencial e CMV + Pessoal; cobertura das fontes históricas.
4. Fórmula da diferença, vendas, recebimentos, saídas e eventuais saldos de caixa.
5. Responsáveis, conferente, data e registros do fechamento atual.
6. Documentos reais para importação e rastreabilidade, sem mudar os processos existentes.
7. Identidade visual, linguagem, legibilidade e uso no celular da equipe.
8. Persistência, permissões e eventual edição/reabertura de fechamentos na fase funcional futura.
