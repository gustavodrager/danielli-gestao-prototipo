# Danielli Gestão — continuidade do protótipo

## Fonte única

- Usar este repositório: `gustavodrager/danielli-gestao-prototipo`, branch principal `main`.
- Vercel existente: `danielli-gestao-prototipo`, projeto `prj_BNKtgmQNBAUeqOm3Z3RnY0lZxuse`.
- Endereço publicado: https://danielli-gestao-prototipo-seven.vercel.app/
- A prévia local executa este mesmo código. Não criar versões paralelas por ZIP, outro repositório ou outro projeto Vercel.
- Antes de editar, consultar o estado local e buscar o GitHub; preservar alterações locais e remotas. Não sobrescrever trabalho concorrente ou usar push forçado.
- Validar build, testes do modelo e a experiência mobile pertinente à mudança antes de publicar. Conferir o commit efetivamente servido pela Vercel.

## Regras confirmadas

- Identidade atual: cabeçalho preto, logo transparente (original preservado), conteúdo claro e detalhes dourados; sem seletor de tema.
- Menu de visões e navegação principal: Visão geral, Caixa e Compras (CMV). Sem botão Histórico real no cabeçalho e sem Fechamento completo neste seletor.
- Unidades: Balcão, Buffet, Massas, Churrasco, Marmita, Vitrine. Almoço → Buffet; Marmitex → Marmita; Lojista → Vitrine. Cores das comandas ainda não confirmadas.
- Unidades representam origem da receita; não ratear custos ou despesas. Compras gerais aproximam CMV quando não há estoque; não apresentar CMV real sem fonte.
- Preservar dados reais, fontes, cobertura e diferenças anotadas. Ausência é null, não zero. Distinguir observado, calculado e estimado. Manter simulações separadas do histórico real.
- Movimento diário fictício abre no dia anterior com registros; nos meses anteriores, no último dia disponível. Seleção manual preservada na URL. Sem card “O caixa, sem repetir contas” na Visão geral.
- Mês vigente em São Paulo por padrão; preservar `mes=AAAA-MM` nos detalhes. Julho/2026 exclusivamente real; demais meses têm registros diários fictícios determinísticos até hoje, identificados separadamente das classificações observado/calculado/estimado. Não inferir composição de recebimentos do livro por unidade.
- Caixa: quatro recebimentos por unidade (débito, crédito, dinheiro, Pix); três taxas percentuais comuns, inicialmente débito 3%, crédito 4% e Pix 1%, editáveis. Campos apagados permanecem desconhecidos; não repor taxas ao recarregar depois de aplicar esse padrão uma vez. Dinheiro sem desconto. Valores em centavos, percentuais em centésimos, arredondar cada desconto antes de somar. Guardar as taxas utilizadas no registro; não recalcular lançamentos antigos.
- Confirmação parcial permitida e identificada; vazio não é zero. Líquido apenas com recebimentos completos e taxas necessárias conhecidas. Líquido não é lucro nem referência bruta da conferência. Registros antigos sem detalhamento preservados, inclusive a referência anterior ao editar. Voucher/iFood independentes no reaproveitamento explícito.
- Implantação gradual: representar a operação atual antes de alterar processos. Não inventar fórmulas, metas, limites, categorias ou regras de negócio.
- Arquivos sincronizados do projeto em sources/ são referências somente para leitura.

Consultar README.md para limitações, validações pendentes com Higor e roteiro de demonstração.
