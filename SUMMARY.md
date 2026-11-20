# Verificação run-20261120-161418

- Commit: `1ea63b4e8557122e701bc14df464dbdf37a323da` (branch `ticket/129-paginar-assuntos`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-20 16:14:21 -0300
- Resumo gerado em: 2026-11-20 16:19:50 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| atendimentos-message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-closed-tickets | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | PASSOU | 6 | `evidence/consult-subjects/` |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-messages-chamados | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-sent-message | NÃO PROVADO: não percorrido nesta execução | 0 | |
| final-routes | NÃO PROVADO: não percorrido nesta execução | 0 | |
| message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| assuntos-pagina (fora do mapa) | PASSOU | 6 | `evidence/assuntos-pagina/` |

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
- Log: `.verify-app/runs/run-20261120-161418/logs/backend.log`

## Detalhe de cada jornada

## Jornada assuntos-pagina: PASSOU

Commit `1ea63b4e8557122e701bc14df464dbdf37a323da`, início 2026-11-20T19:16:40.790Z, duração 3 s.

#### Passos

1. ok: Preparar setor com 23 assuntos em dois módulos (766 ms)
2. ok: Abrir a tela Assuntos na primeira página (357 ms): `01-pagina-1.png`
3. ok: Ir para a última página e voltar pelo endereço (331 ms): `02-ultima-pagina.png`
4. ok: Ordenar por módulo, decrescente (284 ms): `03-ordem-modulo.png`
5. ok: Buscar por solução e recarregar mantendo a busca (312 ms): `04-busca-solucao.png`
6. ok: Estado final no banco (256 ms)

#### Estado final observado

Assuntos do setor:

```json
[
  {
    "total": 24
  }
]
```

Soluções do setor:

```json
[
  {
    "total": 1
  }
]
```

## Jornada consult-subjects: PASSOU

Commit `1ea63b4e8557122e701bc14df464dbdf37a323da`, início 2026-11-20T19:18:48.238Z, duração 3 s.

#### Passos

1. ok: Preparar setor, assuntos e dois chamados (536 ms)
2. ok: Assumir chamado e consultar soluções ao lado do chat (386 ms): `01-assuntos-e-chat.png`
3. ok: Enviar mensagem e buscar sem acentos ou maiúsculas (378 ms): `02-busca-por-solucao.png`
4. ok: Copiar a solução e manter o texto fora do chat (197 ms): `03-solucao-copiada.png`
5. ok: Outro chamado volta à Fila e o anterior lembra a busca (650 ms): `04-busca-restaurada.png`
6. ok: Estado final da conversa e da lista (277 ms)

#### Estado final observado

Mensagem enviada e assunto preservado:

```json
{
  "messages": [
    {
      "body": "*Atendente1 328239470:*\nVou conferir as orientações."
    }
  ],
  "assuntos": 1
}
```

## Comparação com o design

Ticket #129, capturas aprovadas do protótipo na branch `prototype/129`.

- **Página 1** (`assuntos-pagina/01-pagina-1.png` × `129-01-pagina-1.png`): mesmos elementos e na mesma ordem — busca "Assunto ou solução" e filtro de módulo na mesma linha, tabela com as colunas Assunto (ordem inicial crescente, seta no cabeçalho) e Módulo, ações Nova solução/Editar/Excluir na linha do assunto e Editar/Excluir na linha da solução, soluções abertas abaixo do assunto com "N solução/soluções". A captura do protótipo é de administrador (tem o seletor de Setor no topo); a evidência é de supervisor, que vê só o próprio setor, então o seletor não aparece. Diferença de dados: a evidência não tem soluções nas 20 primeiras linhas, por isso o rodapé de paginação fica abaixo da dobra em 1280×800.
- **Última página** (`assuntos-pagina/02-ultima-pagina.png` × `129-03-ultima-pagina.png`): "Página 2 de 2 · 24 assuntos" com a página atual destacada, Anterior habilitada e Próxima desabilitada; a faixa fica no rodapé do cartão da tabela. Mesmo desenho do protótipo ("Página 3 de 3 · 43 assuntos").
- **Ordem por módulo** (`assuntos-pagina/03-ordem-modulo.png` × `129-04-ordem-modulo.png`): cabeçalho Módulo com a seta de decrescente e os assuntos agrupados por módulo; a coluna de ações continua fora da ordenação.
- **Busca por solução** (`assuntos-pagina/04-busca-solucao.png` × `129-05-busca-solucao.png`): só os assuntos com solução que bate, cada um mostrando apenas as soluções correspondentes, a contagem total do assunto embaixo do nome e a paginação oculta (um resultado). O texto buscado fica no endereço (`?busca=portal`) e volta ao recarregar.
