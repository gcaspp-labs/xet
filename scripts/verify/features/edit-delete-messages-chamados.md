# Editar e excluir mensagens em Chamados

O responsável do chamado aberto edita o texto ou a legenda de uma mensagem enviada pelo XET, ou a exclui para todos ou só no XET ("para mim"), pelo menu da mensagem na tela Chamados (#293, spec #290). A conversa mostra "Editada" e "Excluída" nas alterações do cliente e do celular do setor, e um aviso no lugar do conteúdo que o XET ocultou. As versões em Atendimentos chegam na #294.

## Sub-features

- [jornada] O menu da mensagem enviada oferece Editar e Excluir.
- [jornada] Editar usa a faixa "Editando" no compositor, com o texto sem o apelido; Cancelar não chama a API e devolve o rascunho que já existia.
- [jornada] Salvar a edição troca o texto da mesma mensagem, com "Editada", nas duas sessões, sem recarregar e sem mensagem nova.
- [jornada] A janela de exclusão mostra "Excluir para todos", "Excluir para mim" e "Cancelar"; a recusa do WhatsApp mantém a janela, com aviso, e a mensagem como estava.
- [jornada] Excluir para mim troca o conteúdo por "Mensagem excluída no XET" nas duas sessões e depois de recarregar.
- [jornada] Edição e exclusão do cliente mostram o conteúdo conhecido com "Editada" e "Excluída".
- [não coberto] Prazo de 15 minutos e de exclusão para todos, mensagem enviando ou com falha, áudio, temas, teclado e foco, confirmação duplicada, prévia na lista e perda de responsável durante a edição (testes ponta a ponta em `frontend/e2e/message-edit-delete.spec.ts`).
- [manual] Edição de texto e legenda e exclusão para todos chegando num celular real pelo Whatsmeow.

## How to get to it

1. Uma mensagem do cliente chega, o atendente assume o chamado em `/chamados/<id>` e responde.
2. Passando o mouse (ou com o foco) na mensagem enviada, o botão "Ações da mensagem" (⋯) abre o menu com Editar e Excluir.

## Driving it

```bash
scripts/verify/scripts/drive.sh edit-delete-messages-chamados
```

- Mensagem enviada: `getByRole('region', { name: 'Conversa', exact: true }).getByRole('listitem', { name: 'Mensagem enviada' })`; o menu é o botão "Ações da mensagem" dentro dela.
- Edição: faixa `getByRole('group', { name: 'Editando mensagem' })`, campo "Editar mensagem" e botão "Salvar edição".
- Exclusão: `getByRole('dialog', { name: 'Excluir mensagem' })`.
- Recusa da próxima alteração: `t.phone(setor).failNextChange('refused' | 'uncertain')`; edição e exclusão do cliente: `t.phone(setor).edit(...)` e `.revoke(...)`.

## Gotchas

- Achar a mensagem pela posição (`nth`), não pelo texto: o texto muda com a edição e some com a exclusão.
- Com a janela de exclusão aberta, o resto da página sai da árvore de acessibilidade: confira a mensagem com `locator('li[id^="message-"]')`.
- Os prazos (15 minutos e dois dias) vêm do relógio do servidor; a jornada não os percorre.
- O adaptador falso não prova o WhatsApp real: a edição de legenda e a revogação reais são `[manual]`.

## Estado final observável

- **Tela:** a primeira mensagem enviada com o texto novo e "Editada"; a segunda com o aviso "Mensagem excluída no XET"; a do cliente com o texto novo, "Editada" e "Excluída".
- **`messages`:** a primeira enviada com `edited_at` preenchido e sem exclusão; a segunda com `deletion_scope = 'local'` e `deletion_origin = 'agent'`.
- **`message_actions`:** a recusa não grava ação aceita; ficam `edit:accepted` e `delete_local:accepted` (e `delete_everyone:refused`).
