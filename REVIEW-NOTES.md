# Notas da segunda revisão do PR 71

Commit: b6f41b290963c4b86ce4afb9f97c24f377876af1.

A jornada pr71-recheck-verified passou em sete passos: o aviso Contato salvo fica sobre Encerrar, mas o clique no trecho coberto encerra sem força nem espera; o banco confirmou o encerramento e o responsável pelo outro chamado. O link Abrir conversa também abre o chamado pelo sino.

A jornada pr71-action-overlap revelou o defeito residual e foi mantida como FALHOU: estando no chamado 3, assumir o chamado 4 pelo sino, abrir Encerrar no 3 e digitar um assunto faz o link do aviso ocupar parte do botão Encerrar em viewport 1280x560. Com o cursor ali o aviso ficou visível por cinco segundos. O clique no ponto coberto abriu /chamados/4. A captura final mostra a janela ainda aberta, com o contato do chamado 4 e o assunto vazio. O passo final de consulta ao banco dessa jornada não foi alcançado. Não foi tentado salvar o formulário no chamado errado.

As coordenadas deste teste foram calculadas pela interseção dos elementos identificados por seus nomes: o objetivo é provar a interceptação física do clique no trecho coberto. Não houve clique forçado. A espera de cinco segundos nesta reprodução serve para mostrar a pausa do aviso com o cursor, não para fazê-lo desaparecer.

Três tentativas anteriores da jornada auxiliar falharam na construção do caminho do link: (1) usei a lista principal, que navega sem link no aviso; (2) seletor ambíguo entre a lista principal e o sino; (3) fechei o sino com Esc imediatamente após Assumir, antes de observar o aviso. Os registros locais foram preservados em run-20261104-233814, run-20261104-234028 e run-20261104-234121. A jornada corrigida espera o aviso visível e fecha o sino pelo botão. Os critérios do produto não foram retirados ou relaxados.

As cinco jornadas existentes foram executadas em run-20261104-234441, no mesmo commit: todas passaram, 58 passos. As evidências daquela execução são publicadas separadamente.

Cleanup concluído nas duas execuções: nenhum processo, contêiner ou porta da verificação restou. Zero linhas de erro no backend das duas execuções.

Só foram usados usuários, telefones, nomes e mensagens fictícios, com adaptador falso. As capturas e os resumos são publicados com a autorização de Thiago para a T49. Rastros, cookies, senhas e logs completos não são publicados.
