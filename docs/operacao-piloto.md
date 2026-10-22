# Operação do piloto

## Preparação

1. Conectar a conta Neon e conferir plano, limites de armazenamento/computação, retenção de recuperação e custo atual. Esta entrega não contrata plano pago.
2. Criar ambientes separados de homologação e produção; credenciais distintas. Prévia Vercel nunca deve apontar para produção. Não copiar dados de produção para desenvolvimento sem necessidade e autorização.
3. Configurar `DATABASE_URL` privada na Vercel com URL agrupada e TLS verificado; configurar a mesma URL no ambiente administrativo privado do destino escolhido.
4. Executar `db:migrate`, `db:import-july` e bootstrap do gestor. Reexecutar importação deve informar zero novos e preservar os 31 registros. Não executar fixtures ou seed local no Neon.
5. Testar backup/restauração abaixo, autenticação HTTPS, permissões diretas, expiração/revogação e confirmação consultada por outra sessão. Validar os campos com Higor e um operador em celular real.
6. Confirmar SHA, domínio e destino do banco. Promover a mesma versão aprovada para produção; verificar `/api/health` e o fluxo completo novamente.

## Backup e restauração

`pg_dump`/`pg_restore` de versão compatível precisam estar instalados; opcionalmente `PG_TOOL_CONTAINER` usa ferramentas de um contêiner existente. `PG_TOOL_PORT` permite indicar a porta vista de dentro do contêiner. Conexões são passadas pelo ambiente, não em argumentos de processo.

Definir `SOURCE_DATABASE_URL` com conexão direta do Neon é recomendado; na ausência, usa `DATABASE_URL`. Definir `RESTORE_DATABASE_URL` para **outro banco vazio**. Não usar o banco original como destino. Guardar o backup e manifesto em diretório privado (0700), fora do Git, com criptografia e controle de acesso no armazenamento definitivo: o dump contém os dados e hashes do banco. O script não implementa criptografia nem agendamento.

```bash
npm run db:backup -- --output backups/pre-piloto.dump
npm run db:restore-check -- --input backups/pre-piloto.dump
```

O backup mantém um snapshot de leitura consistente durante `pg_dump`, gera SHA256 do arquivo e contagens/resumos de cada tabela. A verificação recusa origem igual ao destino, destino ocupado ou arquivo divergente. Não usa `--clean` nem `CASCADE`; prepara somente o schema vazio e restaura em uma transação. Compara todas as tabelas ao manifesto. Nunca promover um destino com falha de verificação. Arquivos são criados com permissão 0600; cabe ao responsável configurar armazenamento externo, frequência, retenção e ensaio periódico antes do uso operacional.

## Rotina de uma semana

Higor e um operador devem comparar diariamente o lançamento com o controle atual, conferir as seis unidades, recebimentos conhecidos/ausentes, taxas e correções. Registrar dúvidas e divergências sem ajustar o papel para caber no sistema. Não abandonar o processo atual durante o piloto.

Estados esperados: **Salvando**, **Rascunho neste aparelho**, **Rascunho salvo no sistema** e **Lançamento confirmado**. Somente a confirmação reconhecida pelo servidor entra nos indicadores. Após falha de conexão, retomar o rascunho e confirmar explicitamente. Uma resposta incerta mantém a mesma chave de requisição para consultar/repetir sem duplicar. Conflito de versão exige revisar o lançamento atual e o preenchimento preservado.

Em aparelho compartilhado, usar contas individuais e sair ao terminar. Os rascunhos locais ficam vinculados ao usuário para retomada; não são exibidos a outra conta pela interface. O armazenamento do navegador não substitui autenticação do sistema nem backup do banco.

## Pendências de negócio e operação

- Higor: referência de faturamento entre vendas anotadas e registrado; fórmula da diferença; tratamento das saídas; uso do líquido; taxas praticadas; cobertura de julho e pendências da transcrição.
- Não incluir voucher/iFood ou rateios em Entradas sem nova validação de escopo. O livro importado preserva suas formas originais.
- Confirmar responsáveis, correções e uso diário com operador real. Teclado virtual, rede instável e troca de aparelho precisam de observação presencial.
- Definir responsáveis pelo acesso administrativo, entrega privada de links, backup, restauração, atualização de dependências e acompanhamento das falhas.
- Configuração/custos Neon e Vercel, recuperação e homologação precisam ser aprovados antes da entrada em operação.
- CMV, compras, despesas, pessoal, resultado e fechamento completo permanecem fora do piloto.

## Evidências desta implementação — 22/10/2026

- PostgreSQL 17 local: 55 testes aprovados, sem ignorados; TypeScript e build aprovados, com pacote público livre de histórico e exemplos.
- PostgreSQL real Neon/homologação: 31 testes de API/autenticação aprovados, sem ignorados, em schemas temporários; dados públicos dos ambientes preservados.
- Julho reimportado localmente: 31 verificados, zero novos. Bancos Neon receberam os 31 registros e ambas as migrações. Não houve importação de simulações.
- Backup/restauração após migração 002: dez tabelas com contagens e resumos idênticos, histórico com 31 registros e proteção contra TRUNCATE ativa. Repetido com origem real no Neon e destino local separado, preservando TLS verificado; zero vendas fictícias na origem.
- Navegador local: 320/390/430 px, sem rolagem horizontal da página; login/logout, confirmação parcial, edição para seis unidades, zeros explícitos, validação/foco, rascunho offline e retomada após recarregar, duas abas, dashboard do gestor, detalhes/revisões, julho somente leitura e Despesas indisponível.
- Exemplo operacional usado apenas localmente: primeira versão R$ 2.000,00 / R$ 53,00 / R$ 1.947,00; segunda R$ 2.191,34 / R$ 59,42 / R$ 2.131,92. A confirmação ficou no mesmo dia, com duas revisões. Não são dados da Danielli.
- Contas reais, teste em aparelho físico com Higor/operador e acompanhamento de uma semana ainda dependem da entrada no piloto.

Infraestrutura criada: produção Neon `icy-river-31288539`; homologação Neon `dry-mud-23564824`, organização Parsero (Free), São Paulo, PostgreSQL 17, compute 0,25 CU. URLs de conexão ficam privadas. A recuperação instantânea do plano tem janela curta de seis horas; o backup externo recorrente e sua retenção ainda precisam ser definidos antes da semana operacional. Para libpq/pg_dump com `verify-full`, pode ser necessário indicar `sslrootcert` explicitamente conforme o sistema.
