# Verificação run-20261121-083836

- Commit: `9aa69ae6801853bd262c5f2ce1096c2e665afcc2` (branch `ticket/223-dashboard-ajustes`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-21 08:38:39 -0300
- Resumo gerado em: 2026-11-21 08:41:04 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| atendimentos-message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-closed-tickets | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-messages-chamados | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-sent-message | NÃO PROVADO: não percorrido nesta execução | 0 | |
| final-routes | NÃO PROVADO: não percorrido nesta execução | 0 | |
| message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| dashboard-223 (fora do mapa) | PASSOU | 11 | `evidence/dashboard-223/` |

## Fica para a verificação manual ou sem cobertura nestas jornadas

- atendimentos-message-revisions: [não coberto] Setor sem acesso (a API responde 403), temas claro e escuro e alto contraste, e a ordem completa de edições intercaladas entre o XET e o celular do setor (testes ponta a ponta em `frontend/e2e/atendimentos-message-changes.spec.ts` e `message-edit-delete.spec.ts`, e integração em `backend/internal/helpdesk/message_versions_test.go`).
- atendimentos-message-revisions: [manual] A mesma consulta depois de uma edição ou exclusão real recebida pelo Whatsmeow.
- close: [não coberto] Correção de chamado encerrado (`correction.spec.ts`).
- close: [não coberto] Cancelamento de chamado em atendimento e as permissões do cancelamento (`closing.spec.ts`).
- close: [não coberto] Trocar o órgão só para este chamado, no formulário (`closing.spec.ts`).
- connection: [não coberto] Aparelho que não pôde ser avisado ao desvincular (`connection.spec.ts`).
- connection: [não coberto] Volta da conexão ao reiniciar o serviço (`TestConnectionSurvivesRestart`, só integração).
- connection: [manual] Ler o QR code real com o celular do setor.
- connection: [manual] O QR code real trocando sozinho a cada 20 segundos.
- connection: [manual] O celular mostrando "Central de Atendimento" em vez de "Outro dispositivo".
- connection: [manual] Reiniciar o serviço e ver o número voltar sem novo QR code.
- connection: [manual] Desvincular pelo celular e pela tela, com o aparelho sumindo do celular.
- consult-closed-tickets: [não coberto] Paginação, ordem pelas demais colunas e correção do atendimento na ficha (`atendimentos.spec.ts`, `correction.spec.ts`).
- consult-closed-tickets: [não coberto] Abas Detalhes e Histórico da ficha e o chamado anterior de uma transferência (`ficha-atendimento.spec.ts`; o chamado anterior também está em `transfer`).
- consult-subjects: [não coberto] Permissão, setor vazio, ausência de resultados e tela estreita (`subjects.spec.ts`).
- conversas-menu: [não coberto] Listar só os chamados próprios, ordenar por atividade e trocar de chamado (`conversas.spec.ts`).
- conversas-menu: [manual] Receber e responder pelo WhatsApp real.
- edit-delete-messages-chamados: [não coberto] Recusa e resultado incerto do WhatsApp na tela, prazo de 15 minutos e de exclusão para todos, mensagem enviando ou com falha, áudio, temas, teclado e foco, confirmação duplicada, prévia na lista (inclusive excluir para todos), citação em preparo que some quando a mensagem citada é excluída, supervisor já conectado, mensagem do celular sem menu e perda de responsável durante a edição (testes ponta a ponta em `frontend/e2e/message-edit-delete.spec.ts`).
- edit-delete-messages-chamados: [manual] Edição de texto e legenda e exclusão para todos chegando num celular real pelo Whatsmeow.
- edit-delete-sent-message: [não coberto] Prazo de 15 minutos, prazo da exclusão para todos, mensagem enviando ou com falha, áudio, eco, reinício, resultado incerto, concorrência com encerramento e transferência, prévia da lista escondida (testes de integração em `backend/internal/helpdesk/message_actions_test.go`).
- edit-delete-sent-message: [manual] Edição de texto e legenda e exclusão para todos chegando num celular real pelo Whatsmeow.
- final-routes: [não coberto] `/atendimentos/<id>` de chamado ativo, sem acesso (403), e o item do menu ativo em cada caso (`rotas.spec.ts`).
- final-routes: [não coberto] Endereços desconhecidos sem sessão, que vão para o login (`rotas.spec.ts`).
- message-revisions: [não coberto] Edição de legenda, edição e exclusão pelo celular do setor, evento antes da original, chamado encerrado e isolamento por setor (testes de integração em `backend/internal/helpdesk/message_changes_test.go`).
- message-revisions: [manual] Edição e exclusão feitas num celular real chegando pelo Whatsmeow.
- receive-and-assign: [não coberto] Assumir pela lista da tela do chamado, sem mudar de tela (`conversation.spec.ts`).
- receive-and-assign: [não coberto] Vários chamados com a mesma pessoa, sem limite (`conversas.spec.ts`).
- receive-and-assign: [não coberto] Aviso de queda do tempo real e volta automática (`conversas.spec.ts`).
- receive-and-assign: [não coberto] Grupos ignorados e mensagem enviada pelo celular do setor (só testes de integração).
- receive-and-assign: [manual] Mensagem real do WhatsApp chegando à fila de Chamados sem recarregar.
- receive-and-assign: [manual] Mensagem real em grupo não aparece; resposta pelo celular do setor aparece no chamado.
- reply: [não coberto] Histórico dos chamados do contato, na ficha do atendimento (`ficha-atendimento.spec.ts`).
- reply: [não coberto] Áudio gravado, imagens, vídeos e mídias recebidas (`media.spec.ts`).
- reply: [não coberto] Mensagens `pending` marcadas como `failed` ao reiniciar o serviço (só testes de integração).
- reply: [manual] Texto, imagem e PDF chegando ao celular do contato.
- reply: [manual] "Entregue" e "Lida" pelos recibos reais do WhatsApp.
- reply: [manual] Reenvio depois de falha sem duplicar no celular.
- reply: [manual] Áudio gravado chegando como mensagem de voz, com a duração certa.
- transfer: [não coberto] Devolver à fila (`return.spec.ts`).
- transfer: [não coberto] Abrir o chamado anterior pelo destino, sem poder agir nela (`transfer-sector.spec.ts`).
- transfer: [não coberto] Contato com órgão principal: o chamado chega ao destino com esse órgão (regra 14; `TestSectorTransferTakesTheMainOrganizationOfTheContact`).
- transfer: [não coberto] Transferência sem motivo e quadro de origem de uma transferência antiga, com assunto e resolução (`transfer-sector.spec.ts`).
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (`transfer-sector.spec.ts` e testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Sinais do backend

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261121-083836/logs/backend.log`

## Comparação com o design

Comparado com as capturas aprovadas da branch `prototype/223` (abaixo de 1280px):

- Os cards "Agora" e "No período" sumiram, e a quantidade aparece entre parênteses e em destaque no título de Fila e Em atendimento, como no protótipo.
- Assumir aparece como botão primário, e a linha TOTAL e a linha "Do setor" (Recebidos e Tempo médio de espera) seguem o protótipo, com o cabeçalho da tabela em `bg-muted`.
- Diferença 1: o rodapé de paginação usa o componente do sistema ("Página X de Y · N chamados", com os números das páginas) em vez do "1–5 de N / Anterior 1/2 Próxima" do protótipo. Decisão: a regra 7 de `interface.md` continua valendo fora da exceção registrada em `dashboard.md` (5 por página, montadas no navegador), e o rodapé fica igual ao do resto do sistema.
- Diferença 2: o cabeçalho da tabela usa o `table-head` do design system (11px, caixa alta, `text-ink` sobre `bg-muted`), não o `body-strong` do protótipo. Para caber em 1280px, o título "Tempo médio de atendimento" quebra em duas linhas; no protótipo ele ocupava uma.
- As linhas vazias que mantêm a altura das listas entre as páginas não aparecem (sem borda e sem conteúdo).

## Não provado

- A jornada rodou em 1280px; a largura de celular (375px) e o texto "Maior" ficam cobertos pelos testes ponta a ponta (`dashboard.spec.ts`).
- Nada aqui depende do WhatsApp real.

## Detalhe de cada jornada

## Jornada dashboard-223: PASSOU

Commit `9aa69ae6801853bd262c5f2ce1096c2e665afcc2`, início 2026-11-21T11:39:33.815Z, duração 8 s.

#### Passos

1. ok: Preparar setor conectado, com dois atendentes (858 ms)
2. ok: Doze chamados chegam à fila (503 ms)
3. ok: Seis chamados são assumidos por um atendente (494 ms)
4. ok: Cada lista mostra a quantidade entre parênteses no título, sem cartões (2632 ms): `01-titulos-com-quantidade.png`
5. ok: A Fila pagina de 5 em 5, os mais recentes primeiro (328 ms): `02-fila-pagina-1.png`
6. ok: A segunda página mantém a altura da tabela (292 ms): `03-fila-pagina-2.png`
7. ok: Em atendimento pagina sozinha e também mantém a altura (316 ms): `04-em-atendimento-pagina-2.png`
8. ok: A tabela tem Total e a linha Do setor com os números da pessoa (213 ms): `05-total-e-do-setor.png`
9. ok: Assumir é o botão de destaque (primary) (267 ms): `06-assumir-primary.png`
10. ok: Recolher funciona nas duas seções e a escolha sobrevive ao recarregar (915 ms): `07-periodo-recolhido.png`, `08-recolhido-apos-recarregar.png`, `09-periodo-aberto.png`
11. ok: Estado final no banco (128 ms)

#### Estado final observado

Chamados do setor por situação:

```json
[
  {
    "status": "queued",
    "n": 6
  },
  {
    "status": "in_progress",
    "n": 6
  }
]
```
