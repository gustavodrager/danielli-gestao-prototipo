# Danielli Gestão — aplicação piloto

## Fonte única

- Usar este repositório: `gustavodrager/danielli-gestao-prototipo`, branch principal `main`.
- Vercel existente: `danielli-gestao-prototipo`, projeto `prj_BNKtgmQNBAUeqOm3Z3RnY0lZxuse`.
- Endereço publicado: https://danielli-gestao-prototipo-seven.vercel.app/
- A prévia local executa este mesmo código. Não criar versões paralelas por ZIP, outro repositório ou outro projeto Vercel.
- Antes de editar, consultar o estado local e buscar o GitHub; preservar alterações locais e remotas. Não sobrescrever trabalho concorrente ou usar push forçado.
- Validar build, testes do modelo e a experiência mobile pertinente à mudança antes de publicar. Conferir o commit efetivamente servido pela Vercel.

## Regras confirmadas

- Identidade atual: cabeçalho preto, logo transparente (original preservado), conteúdo claro e detalhes dourados; sem seletor de tema.
- Menu de visões e navegação principal: Visão geral, Entradas e Despesas. O menu inferior fica fixo e sempre visível, com espaço reservado para não cobrir campos e ações. Sem botão Histórico real no cabeçalho e sem Fechamento completo neste seletor.
- Unidades: Balcão, Buffet, Massas, Churrasco, Marmita, Vitrine. Almoço → Buffet; Marmitex → Marmita; Lojista → Vitrine. Cores das comandas ainda não confirmadas.
- Unidades representam origem da receita; não ratear custos ou despesas. Compras gerais aproximam CMV quando não há estoque; não apresentar CMV real sem fonte.
- Preservar dados reais, fontes, cobertura e diferenças anotadas. Ausência é null, não zero. Distinguir observado, calculado e estimado. Manter simulações separadas do histórico real.
- Movimento diário abre no dia anterior disponível; nos meses anteriores, no último dia disponível. Seleção manual preservada na URL. Sem card “O caixa, sem repetir contas” na Visão geral.
- Mês vigente em São Paulo por padrão; preservar `mes=AAAA-MM` nos detalhes. Produção exibe somente registros autenticados do PostgreSQL. Julho/2026 exclusivamente real e somente leitura, importado idempotentemente. Não inferir composição de recebimentos do livro por unidade. Código e exemplos antigos ficam preservados como referência, fora do pacote público. Não importar simulações automaticamente.
- Caixa: quatro recebimentos por unidade (débito, crédito, dinheiro, Pix); três taxas percentuais comuns, inicialmente débito 3%, crédito 4% e Pix 1%, editáveis. Campos apagados permanecem desconhecidos; não repor taxas ao recarregar depois de aplicar esse padrão uma vez. Dinheiro sem desconto. Valores em centavos, percentuais em centésimos, arredondar cada desconto antes de somar. Guardar as taxas utilizadas no registro; não recalcular lançamentos antigos.
- Confirmação parcial permitida e identificada; vazio não é zero. Líquido apenas com recebimentos completos e taxas necessárias conhecidas. Líquido não é lucro nem referência bruta da conferência. Registros antigos sem detalhamento preservados, inclusive a referência anterior ao editar. Voucher/iFood independentes no reaproveitamento explícito.
- Implantação gradual: representar a operação atual antes de alterar processos. Não inventar fórmulas, metas, limites, categorias ou regras de negócio.
- Arquivos sincronizados do projeto em sources/ são referências somente para leitura.

Consultar README.md para limitações, validações pendentes com Higor e roteiro de demonstração.

## Base técnica aprovada — piloto

- React + TypeScript + Vite; API Node.js/TypeScript central em api/index.ts no mesmo projeto Vercel; PostgreSQL Neon, pg, SQL parametrizado e Zod. Sem Supabase, Railway, filas ou ORM.
- Piloto inclui login, contas individuais, Entradas, revisões e dashboard. Despesas fica indisponível. Não reativar seletor de perfil como controle de acesso.
- Permissões obrigatórias no servidor: operador no dia atual de São Paulo e somente seus registros; gestor pode consultar todos e corrigir datas passadas, exceto julho importado.
- Sessão absoluta 7 dias; ativação/redefinição manual com token único de 30 minutos. Não registrar senhas/tokens/conexões.
- Confirmações transacionais com versão otimista e UUID idempotente. Conflito preserva preenchimento, sem mesclar automaticamente. Taxas oficiais e totais calculados no servidor.
- Rascunho IndexedDB separado por usuário/data, cópia no servidor e proteção entre abas. Reconexão nunca confirma automaticamente. Preservar textos inválidos em rascunhos.
- Migrações aplicadas são imutáveis; acrescentar novas. Homologação separada da produção. Nunca usar banco de produção nos testes nem publicar credenciais/arquivos .env/backups.
- npm run build verifica que histórico real, exemplos e credenciais não estão no pacote público. Testes de API exigem PostgreSQL real; test:integration não pode passar silenciosamente sem banco.
- Não promover a aplicação para produção antes de conectar o Neon, migrar/importar, criar o gestor e validar restauração/configuração/custo. Prévia e PR ficam no mesmo repositório/projeto.
