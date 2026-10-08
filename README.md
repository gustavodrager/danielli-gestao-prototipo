# Danielli Gestão — Protótipo UX/UI

Protótipo mobile-first do Restaurante e Doceria Danielli, com o logo fornecido, **cabeçalho preto, logo transparente, conteúdo claro e detalhes dourados**. O menu no topo e a navegação principal usam **Visão geral, Caixa e Compras (CMV)**. O botão Histórico real foi removido do cabeçalho e Fechamento completo foi retirado do seletor de visões. Não há seletor de tema. Unidades confirmadas: **Balcão, Buffet, Massas, Churrasco, Marmita e Vitrine**. O indicador antes chamado Prime Cost aparece como **CMV + Pessoal**; a rota antiga continua compatível.

## Ambiente único e fluxo de trabalho

- **Fonte única do código:** [gustavodrager/danielli-gestao-prototipo](https://github.com/gustavodrager/danielli-gestao-prototipo), branch `main`.
- **Versão publicada:** [Danielli Gestão](https://danielli-gestao-prototipo-seven.vercel.app/), projeto Vercel existente `danielli-gestao-prototipo` (`prj_BNKtgmQNBAUeqOm3Z3RnY0lZxuse`). A integração com GitHub publica os commits de `main` automaticamente.
- **Prévia local:** `http://127.0.0.1:5173`, executando uma cópia do mesmo repositório; não é uma versão independente.

Antes de continuar em outra conversa ou máquina, buscar a versão atual do GitHub e conferir alterações locais. Trabalhar sempre neste repositório, preservar alterações concorrentes, validar build/modelo e experiência mobile antes de enviar commits. Depois da publicação, conferir que o commit ativo na Vercel corresponde ao commit enviado.

ZIPs antigos são somente backups históricos. **Não atualizar nem usar ZIP para transportar versões entre conversas.** Uma conversa na nuvem deve acessar o mesmo repositório GitHub. Não criar outro repositório ou projeto Vercel para a mesma aplicação. Dados de simulação da aba continuam locais; esta unificação é do código e da publicação, sem introduzir backend ou sincronização de lançamentos.

## Dados e origem

O protótipo abre no **mês vigente em São Paulo**. Os botões cobrem maio de 2026 em diante, sem meses futuros, e mantêm o período nos detalhes e retornos por `mes=AAAA-MM`. Maio, junho, agosto, setembro e outubro até o dia atual usam registros diários fictícios determinísticos; novos dias não alteram exemplos antigos. Julho de 2026 é **exclusivamente real**: 31 fotos do livro de fechamento, páginas 132–162, encontradas na pasta [Daniella no Google Drive](https://drive.google.com/drive/folders/19OV4AVzlKV9nKQmntYRkdPszBdFzbDc-). As cópias repetidas não são contadas duas vezes.

`src/real-cash.json` contém valores em centavos, data, página, nome do arquivo e link individual para cada foto. Foram transcritos os totais legíveis de vendas, registrado, diferença, saídas e as seis formas de recebimento. **Transcrição inicial a conferir com Higor**, sem alterar os valores escritos. As fotos e os nomes pessoais presentes nas saídas não foram copiados para o repositório ou para o site; o original continua no Drive e exige sua permissão de acesso.

- Total de vendas anotado: 31/31 dias, R$ 653.640,81. A tela preserva o nome do campo no livro; a referência de faturamento gerencial entre vendas e registrado ainda depende de Higor.
- Total registrado: 30/31 dias. O dia 25 tem rasura e permanece `null`.
- Recebimentos e saídas: 30/31 dias. O desfoque do dia 29 impede uma transcrição segura dessas linhas; ficam `null`.
- Dia 18: recebimentos + saídas ficam R$ 100,00 abaixo das vendas anotadas.
- Dia 25: a mesma composição fica R$ 0,50 abaixo das vendas. Pendência visível, sem ajustar o livro.
- Zero só aparece quando está explicitamente escrito na fonte, como dinheiro em 13/07. Subtotais sempre informam sua cobertura; campo pendente não é zero.

CMV, despesas gerais, pessoal, resultado e CMV + Pessoal ficam **indisponíveis no histórico real**. Saídas do caixa não são classificadas automaticamente nesses indicadores. O detalhamento das saídas e das descrições de receita continua nos originais, aguardando classificação e confirmação. Correspondências confirmadas pelo usuário: **Almoço → Buffet**, **Marmitex → Marmita**, **Lojista → Vitrine**. Os subtotais legíveis dessas origens têm detalhamento por dia, preservando o nome original e sua cobertura. As demais origens continuam sem associação por suposição. Linhas sem valor anotado ou desfocadas são `null`, sem percentuais que sugiram um mix completo do mês.

A origem acompanha o mês selecionado. Julho não pode ser completado ou apagado pelos cenários de demonstração. Em **Mais**, operação regular, diferença e ausência de dados são estados dos meses fictícios. Os mesmos lançamentos diários sustentam totais, gráficos, composição e detalhes; documentos DEMO não têm links para supostos originais. A marca “Dados fictícios” é independente da classificação observado/calculado/estimado. Comparações entre meses parciais usam os mesmos dias do anterior, com origem e cobertura compatíveis; julho/agosto não recebem comparações real versus fictício.

## Experiência disponível

- **Acesso principal do Caixa → Vendas por unidade** em `/caixa/vendas`: uma unidade por vez, quatro recebimentos editáveis (débito, crédito, dinheiro e Pix), avanço entre unidades e zero explícito por “Sem movimento”. Três taxas percentuais comuns às seis unidades começam em **débito 3%, crédito 4% e Pix 1%**, conforme solicitado. São editáveis; apagar mantém desconhecido, sem reposição ao recarregar. Uma atualização única aplica esses percentuais à aba e a rascunhos não confirmados, preservando registros confirmados e suas taxas. Taxas confirmadas são reutilizadas nos próximos preenchimentos. Moeda em centavos; taxas em centésimos de ponto percentual, validadas entre 0% e 100%; descontos arredondados por unidade e forma antes de somar. Bruto, taxas e líquido têm cobertura visível; líquido não é lucro e não substitui vendas na conferência. Confirmação parcial mantém lacunas e só calcula líquido das unidades completas com taxas necessárias conhecidas. Resumo, correção, edição, histórico e rascunho são locais. Cada registro guarda suas taxas; consultas não alteram as últimas taxas em uso. Registros antigos sem detalhamento mantêm seus totais sem distribuição; ao adicionar recebimentos, a referência antiga fica preservada separadamente. Reaproveitamento explícito na conferência copia apenas formas conhecidas nas seis unidades e preserva Voucher, iFood, campos desconhecidos e referência de vendas.
- **Menu do topo → Compras / CMV** abre `/compras/cmv`: data, total de compras do dia e referência opcional, com confirmação e edição apenas nesta sessão. Zero é explícito; ausência ou valor inválido não pode ser confirmado. O valor representa compras gerais, sem rateio por unidade, CMV real ou percentuais inferidos. A confirmação não muda os indicadores históricos.
- As mesmas visões estão disponíveis em **Mais**. O menu fecha ao selecionar, clicar fora ou usar Escape. O perfil de apresentação é retomado pela rota de entrada; recarregar recupera os preenchimentos locais.
- Visão real do mês, média dos 31 dias transcritos, gráfico diário navegável, subtotais por recebimento e pendências.
- Drill-down real: indicador → dia → campos do fechamento → conferência aritmética → foto original no Drive.
- Meses fictícios: indicadores, composição, fornecedor/origem e lançamento; gráfico abre no dia anterior disponível (último dia nos meses encerrados), com seleção manual preservada → registros do dia → lançamento → retorno ao mesmo dia e mês. A chamada “O caixa, sem repetir contas” foi removida; o Caixa permanece no menu.
- Caixa em quatro etapas: recebimentos/responsáveis → unidades → saídas → conferência. Edições, rascunho e conclusão apenas na sessão atual.
- Distinção observado/calculado/estimado, fontes, roteiro de apresentação e implantação gradual.
- Estados vazios, indisponíveis, erro de formulário e sucesso; navegação inferior e foco acessível.

## Limites de negócio preservados

Unidades representam origem da receita. Não há rateio de despesas ou CMV por unidade, nem atribuição inventada de cores de comanda. Compras aproximam o CMV nos exemplos; sem estoques inicial/final, CMV, resultado e CMV + Pessoal permanecem estimados.

O formulário de caixa ainda é uma **simulação**, com fórmula ilustrativa recebimentos − vendas e saídas separadas. A diferença só é calculada com as seis formas de recebimento e a referência de vendas informadas; parcial ou inválido mantém “A conferir”. O histórico real preserva os campos do livro e mostra duas comparações aritméticas: vendas − registrado e recebimentos + saídas − vendas. Isso ajuda a conferir a transcrição; não estabelece uma fórmula operacional sem a validação de Higor.

Sem backend, upload ou integração. Recarregar mantém o mês da URL e recupera rascunhos e registros de simulação armazenados nesta aba. Uma nova visita sem mês abre o vigente. O navegador pode restaurar uma sessão; em dispositivo compartilhado, apague as simulações em Mais. Concluir a simulação não altera os indicadores históricos. Categorias, pessoal, nomes de responsáveis e detalhamento gerencial dos originais ainda exigem conferência e classificação.

## Executar e validar

Node.js 24, alinhado à Vercel:

```bash
npm ci
npm run dev
npm run build
npm test
```

Os 15 testes do modelo verificam calendário e mudança de ano, dias cobertos, estabilidade dos exemplos, reconciliação, preservação de julho, centavos, percentuais, arredondamento, valores ausentes/zero/inválidos, confirmação parcial, migração dos registros antigos e taxas congeladas. A revisão desta entrega foi executada no navegador em 320/390/430 px, incluindo digitação, foco, revisão/correção, retomada, histórico, filtros e retornos. O roteiro automatizado abaixo foi atualizado e conferido sintaticamente, mas não foi executado nesta entrega. Com o servidor iniciado, prepare o Chromium e execute o teste de navegação:

```bash
npx playwright install chromium
npm run test:ui
```

`BASE_URL` pode apontar para outro servidor local. Não apontar para Vercel sem autorização de publicação dos dados reais. O roteiro Playwright cobre mês vigente, histórico real, filtros, retorno, gráfico, teclado, recebimentos, taxas, valores ausentes/zero/inválidos, edição, retomada, compras, registros antigos e layouts de 320/390/430 px. O roteiro anterior com agent-browser continua disponível em `npm run test:ui:legacy`; suas expectativas refletem a interface anterior e precisam ser revisadas antes de uso. A checagem automática não substitui teste de teclado virtual em aparelhos reais ou uma auditoria completa de acessibilidade. Evidências ficam em `artifacts/`, ignorado pelo Git. `vercel.json` suporta acesso direto às rotas; o build gera `dist/`.

## Validar com Higor

1. Conferência da transcrição, rasura de 25/07 e nova foto de 29/07.
2. Inconsistências de R$ 100,00 (18/07) e R$ 0,50 (25/07).
3. Conceitos de total de vendas/registrado e referência do faturamento gerencial.
4. Fórmula operacional da diferença e tratamento das saídas.
5. Demais descrições do livro e cores das comandas. Almoço/Buffet, Marmitex/Marmita e Lojista/Vitrine já confirmados.
6. Classificação das saídas, compras/CMV, despesas e composição de pessoal, evitando dupla contagem.
7. Uso do líquido após taxas na gestão, taxas praticadas, responsáveis, conferência e teclado virtual em aparelho real.
8. Persistência, permissões e edição/reabertura na fase funcional futura.

## Evolução UX/UI — 06/10/2026

- Vendas e as seis unidades vêm antes dos detalhes de caixa. Buffet/Marmita/Vitrine preservam os subtotais e coberturas reais; Balcão/Massas/Churrasco aparecem sem dados identificados. Não calculamos mix com coberturas diferentes.
- Diferenças anotadas estão em **Caixa e conferência**, sem estilo de resultado ou lucro. Recebimentos e indicadores sem fonte ficam em seções recolhíveis.
- Recortes de compras mostram o percentual daquele valor sobre o faturamento geral. A soma é calculada; sua utilização como aproximação de CMV permanece estimada.
- Nome, período, valor e cobertura permanecem no resumo do recorte. Explicações podem ser abertas em **Como este número foi formado**.
- Dias têm busca por data e filtro de pendências. O retorno preserva o indicador, os filtros e a posição da página durante a navegação. O gráfico revela data e valor antes de abrir o fechamento; seleção mantida na URL.
- A entrada operacional ficou mais compacta, com textos de pelo menos 12 px e campos de 16 px. Enter passa ao próximo campo; no último valor, foca a confirmação. A navegação não fica sobre os campos ou sobre a ação principal. O comportamento do teclado virtual ainda deve ser observado em aparelho real.
- Vendas confirmadas do mesmo dia podem ser reaproveitadas no fechamento, sem eliminar a referência de vendas. O fechamento não substitui os recebimentos e as taxas confirmados na entrada simples.
- **Registros da simulação** em `/simulacao` demonstra entrada → registro → indicadores, em contexto separado. Soma por mês com cobertura visível e edição nos formulários. Totais diários de compras não geram fornecedores, categorias ou documentos inexistentes.
- `sessionStorage`, com chave versionada, guarda somente preenchimentos de demonstração da aba. Não copia o livro real para esse armazenamento. Estado de salvamento indica quando o armazenamento está disponível; se falhar, o preenchimento permanece somente em memória.
- Histórico por data nas entradas simples: confirmar atualiza o total do mesmo dia, com aviso visível. Fechamentos completos têm identificação independente e podem coexistir na mesma data; editar atualiza somente o fechamento escolhido. Frequência real por dia/turno continua pendente de Higor.
- A evolução foi inicialmente entregue sem publicação. Em 06/10/2026, Gustavo autorizou explicitamente publicar a versão completa no repositório existente e na Vercel, incluindo os dados financeiros reais e as referências a fontes privadas. As fotos originais continuam sujeitas às permissões do Drive.

### Teste observado proposto

Realizar uma sessão de 20–30 minutos com Higor e um operador, usando dados fictícios: registrar seis unidades, deixar uma desconhecida, registrar compras sem detalhes, retomar rascunho, reaproveitar vendas no fechamento e conferir um dia no dashboard. Medir tempo por tarefa, dúvidas, campos repetidos, cliques de retorno e erros de interpretação de zero/ausência. Verificar também o teclado virtual em celular real. Este teste com pessoas **ainda não foi realizado**.

Confirmar com Higor: referência de faturamento (vendas/registrado), fórmula de diferença e saídas, registros por dia/turno, responsáveis e conferência, categorias atuais de compras, composição de pessoal, detalhamento disponível nas fontes e cores das comandas. Não foram criados limites de CMV, metas ou rateios.

## Logo transparente — 07/10/2026

Edição com `imagegen` do logo fornecido para remover o fundo e conservar o desenho, texto e dourado. Original preservado em `public/danielli-logo.png`; recorte RGBA com transparência em `public/danielli-logo-transparent.png`, usado no cabeçalho preto. A geração foi uma edição da imagem original, sem novo símbolo ou slogan.
