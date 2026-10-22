# API do piloto

JSON, mesma origem, prefixo `/api`. Respostas autenticadas não são cacheadas. Erros têm `{error:{code,message,details?}}`; o identificador de requisição vai em `X-Request-Id`. Nunca registrar cookies, senhas, tokens ou corpos financeiros.

Consultar `/auth/session` antes de mutações; enviar o `csrfToken` retornado no cabeçalho `X-CSRF-Token`, cookie da mesma origem e `Content-Type: application/json`. Toda mutação verifica origem e CSRF, inclusive login. Autorização é verificada novamente na transação de gravação.

| Método e caminho | Uso |
|---|---|
| GET `/health` | Disponibilidade e estrutura do banco, sem dados pessoais |
| GET `/auth/session` | Usuário, CSRF e dia atual em São Paulo |
| POST `/auth/login` | Identificador e senha |
| POST `/auth/logout` | Revoga sessão atual |
| POST `/auth/set-password` | Consome link único de ativação/redefinição |
| POST `/auth/change-password` | Troca própria senha, revoga sessões |
| GET/POST `/users` | Lista/cria usuários; gestor |
| PATCH `/users/:id` | Nome/perfil/situação, com proteção do último gestor ativo |
| POST `/users/:id/reset` | Gera link de redefinição; gestor |
| GET `/sales?month=AAAA-MM` | Todos para gestor, próprios para operador |
| GET/PUT `/sales/AAAA-MM-DD` | Consulta/confirma/corrige, com permissões por data/criador |
| GET `/sales/AAAA-MM-DD/revisions` | Fotografias de cada versão |
| PATCH `/sales/:id/date` | Corrige data com versão e requestId; gestor |
| GET `/sales-drafts?month=AAAA-MM` | Rascunhos próprios do mês |
| GET/PUT `/sales-drafts/AAAA-MM-DD` | Lê/salva texto digitado do próprio usuário |
| GET `/dashboard?month=AAAA-MM` | Mesmos registros operacionais ou histórico de julho; gestor |
| GET `/history?month=2026-07` | Histórico original importado; gestor |
| GET `/history/AAAA-MM-DD` | Documento transcrito do dia; gestor |

Confirmar recebe `{date, receipts, rates, expectedVersion, requestId}`. `receipts` é objeto com as seis unidades, cada uma com `debito`, `credito`, `dinheiro`, `pix`: inteiro em centavos ou `null`. `rates` tem `debito`, `credito`, `pix`: inteiro entre 0 e 10000 ou `null`. `expectedVersion:null` cria; inteiro corrige versão existente. O servidor calcula o registro oficial e ignora/rejeita totais inventados pelo cliente mediante validação estrita. Resposta `{sale:StoredSale}`.

Rascunho recebe texto do `UnitSalesDraft`, `baseVersion` e `expectedVersion` próprios. Texto inválido é preservado; somente confirmação exige números válidos. As versões do rascunho e da venda têm propósitos separados.

`409` indica conflito de versão, dia ocupado ou reutilização indevida de chave. Preservar preenchimento e pedir escolha explícita. `401` leva a novo login sem apagar rascunhos locais. `403` indica falta de permissão; `422` campo/conteúdo inválido; `429` tentativas excedidas; `503` banco indisponível/não configurado. Não transformar falhas em sucesso ou confirmar automaticamente na reconexão.

A fonte de tipos é `shared/contracts.ts`, com validações em `server/auth.ts` e `server/sales.ts`. Datas civis são `AAAA-MM-DD`; timestamps são ISO com fuso. Não confiar no relógio ou no perfil selecionado no navegador para autorizar gravações.
