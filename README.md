# Danielli Gestão — aplicação piloto

Aplicação mobile-first com **React, TypeScript e Vite**, API **Node.js/TypeScript nas Vercel Functions** e **PostgreSQL no Neon**, usando `pg`, SQL parametrizado e Zod. Interface clara e dourada, cabeçalho preto e logo transparente.

O piloto contempla **login, usuários, Entradas, revisões e dashboard autenticado**. Despesas, CMV, pessoal, resultado e fechamento completo ficam para a próxima etapa. O código anterior continua preservado, mas seus exemplos e o histórico real não são enviados no pacote público do navegador. Documentação anterior: [protótipo histórico](docs/prototipo-historico.md).

## Ambiente único

Repositório: [gustavodrager/danielli-gestao-prototipo](https://github.com/gustavodrager/danielli-gestao-prototipo). Projeto Vercel existente: `danielli-gestao-prototipo`, ID `prj_BNKtgmQNBAUeqOm3Z3RnY0lZxuse`. Domínio principal: [danielli.parsero.co](https://danielli.parsero.co). Sem ZIPs, outro repositório ou outro projeto Vercel.

**Infraestrutura preparada em 22/10/2026:** bancos Neon independentes `danielli-producao` e `danielli-homologacao`, plano Free, região São Paulo; cada ambiente recebe sua conexão privada na Vercel. API em `gru1`, próxima ao banco. Uma prévia sem `DATABASE_URL` mostra indisponibilidade e não aceita lançamentos. Não há fallback para dados fictícios ou para o armazenamento antigo do protótipo.

## Executar localmente

Node.js 24 e PostgreSQL 17 (ou versão compatível). Copie `.env.example` para `.env.local` e configure um banco local ou de homologação. As conexões reais nunca devem entrar no Git, capturas ou logs. Não usar prefixo `VITE_` nas variáveis do banco.

```bash
npm ci
npm run db:migrate
npm run db:import-july
npm run db:bootstrap -- --login higor --name Higor --origin http://127.0.0.1:5173
npm run dev
```

O procedimento administrativo mostra um link de ativação de uso único, válido por 30 minutos. Entregue-o somente ao titular, que define a própria senha. Depois do primeiro gestor, as contas são criadas na aplicação. Recuperação administrativa do gestor:

```bash
npm run db:bootstrap -- --reset --login higor --origin https://danielli.parsero.co
```

Links e senhas não devem ser incluídos em issues, PRs ou logs de implantação. A redefinição revoga sessões existentes e invalida a senha anterior até a conclusão do link.

`npm run dev` serve interface e API em `http://127.0.0.1:5173`, usando a mesma entrada `handleRequest` da Vercel. Reinicie o servidor depois de alterar código do backend. `npm run preview` serve somente o pacote estático; não substitui o servidor completo.

## Contratos e regras

- Uma venda consolidada por data; seis unidades e quatro recebimentos por unidade. Valores confirmados são inteiros em centavos; taxas são centésimos percentuais (`300 = 3%`). `null` significa desconhecido e zero exige informação explícita.
- O servidor calcula totais, descontos e cobertura. Cada desconto é arredondado por unidade/forma. As taxas ficam fotografadas em cada confirmação; taxas futuras não recalculam o passado. O líquido após taxas não é lucro.
- Confirmação parcial é permitida. Bruto soma valores conhecidos; líquido somente para unidades com quatro recebimentos e taxas necessárias conhecidas. Ausências não viram dias ou unidades com zero.
- `expectedVersion` protege contra edições concorrentes. `requestId` identifica a confirmação: repetir o mesmo conteúdo retorna o resultado original; reutilizar a chave com outro conteúdo é rejeitado. Venda, 24 recebimentos e revisão são gravados na mesma transação/conexão.
- Operador registra/corrige somente o dia atual de São Paulo, em registros que criou, e consulta seus próprios registros. Gestor consulta todos e corrige datas anteriores; julho importado permanece somente leitura. Alteração de data não sobrescreve outro dia e deixa revisão.
- Rascunhos guardam o texto digitado, inclusive inválido, em IndexedDB por usuário/data e no servidor. Duas abas não editam o mesmo rascunho local simultaneamente. Conflitos exigem escolha explícita; nenhuma mesclagem ou confirmação acontece automaticamente ao reconectar.
- Sessões aleatórias de 7 dias absolutos, hash no banco, cookie `HttpOnly`, `Secure` em HTTPS e `SameSite=Lax`; proteção de origem/CSRF e limitação de tentativas persistida no banco. Senhas `scrypt`, salt aleatório, parâmetros versionados, 15–128 caracteres. Logout, redefinição e desativação revogam sessões.
- Julho é importado idempotentemente de `src/real-cash.json`: 31 registros originais, fontes, campos, notas e pendências. Não distribuir recebimentos entre unidades por suposição. Arquivo não alterado nesta entrega; API exige autenticação de gestor. Os links originais continuam sujeitos à permissão do Drive.
- Rascunhos e simulações antigas não entram no dashboard. Não importar automaticamente valores de `sessionStorage` do protótipo. CMV, despesas e custos não são rateados entre unidades.

Contratos compartilhados: `shared/contracts.ts`; cálculos puros: `src/unit-sales.ts` e `src/domain.ts`; esquema e evoluções: `db/migrations/`. Migrações aplicadas têm checksum e não podem ser editadas. Consulte [operação e piloto](docs/operacao-piloto.md) e [API](docs/api.md).

## Validar

Configure **somente um banco descartável de testes** em `.env.test.local` com `DATABASE_URL_TEST`. Os testes criam schemas isolados e removem apenas esses schemas. As contas de `tests/seed-local.ts` são artificiais, restritas a ambiente local e nunca devem ser usadas em produção.

```bash
npm test
npm run test:integration
npm run build
```

`test:integration` falha se a conexão de testes estiver ausente. A integração usa PostgreSQL real e cobre autenticação, revogação, permissões diretas, transações, centavos/ausência/zero, parciais, idempotência, concorrência, rascunhos e importação íntegra. O build inclui TypeScript estrito da interface/API e verificação contra dados reais, exemplos ou credenciais no pacote público. A CI executa testes e build com PostgreSQL 17.

A revisão mobile usa navegação real em 320/390/430 px: operador → preenchimento → revisão → confirmação → gestor → dashboard → detalhes → revisões, incluindo perda de conexão, retomada e conflito entre abas. Teclado virtual e uso com Higor/operador em aparelhos reais ainda precisam ser validados. Os scripts `test:ui:prototype` e `test:ui:prototype-legacy` refletem exclusivamente o protótipo anterior e não são critérios de aceite da aplicação.

## Publicação e próximos passos

Separar `DATABASE_URL` de **Preview/homologação** e **Production** no mesmo projeto Vercel. Usar a conexão agrupada do Neon com TLS verificado. `APP_ORIGIN` é opcional: sem ele, a API aceita somente a origem da própria requisição. Se definido, usar a origem exata de cada ambiente; não configurar o domínio de produção nas prévias.

Antes de promover: aplicar migrações, importar/verificar julho, criar o primeiro gestor, conferir `/api/health`, validar sessões/cookies em HTTPS e a mesma confirmação em duas sessões independentes. A importação e o bootstrap são procedimentos administrativos, não etapas automáticas de cada build.

A entrada central é `api/index.ts`; `vercel.json` prioriza `/api/*` antes do fallback da interface. O build não executa migrações, não cria usuários e não altera dados. Verificar o SHA efetivamente implantado antes do piloto.

A liberação depende de conexão Neon, ambientes separados, revisão atual de configuração/custo, restauração em banco separado e validação com Higor e um operador. Não foram definidos fornecedores de e-mail, filas ou novas regras de negócio. O piloto será de uma semana, com conferência diária contra o controle atual.
