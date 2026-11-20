# Editar e excluir mensagem enviada pelo XET

O responsável do chamado aberto edita o texto ou a legenda de uma mensagem enviada pelo XET, ou a exclui para todos ou só no XET ("para mim"), pela API (#292, spec #290). O menu, a janela e o compositor com "Editando" estão na #293 (jornada `edit-delete-messages-chamados`), e as versões em Atendimentos chegam na #294: esta jornada chama a API direto e prova o efeito na conversa e no banco.

## Sub-features

- [jornada] Quem não é o responsável recebe 403 ao editar ou excluir.
- [jornada] Recusa do WhatsApp não muda a mensagem.
- [jornada] A edição troca o texto da mesma mensagem na conversa aberta, sem recarregar e sem mensagem nova, com o apelido do envio.
- [jornada] Excluir para todos e "para mim" ficam gravados com origem e alcance, sem apagar o conteúdo.
- [não coberto] Prazo de 15 minutos, prazo da exclusão para todos, mensagem enviando ou com falha, áudio, eco, reinício, resultado incerto, concorrência com encerramento e transferência, prévia da lista escondida (testes de integração em `backend/internal/helpdesk/message_actions_test.go`).
- [manual] Edição de texto e legenda e exclusão para todos chegando num celular real pelo Whatsmeow.

## How to get to it

1. Uma mensagem do cliente chega, o atendente assume o chamado em `/chamados/<id>` e responde.
2. `POST /api/messages/<id>/edit` com `{ clientRequestId, body }`, ou `POST /api/messages/<id>/delete` com `{ clientRequestId, scope: 'everyone' | 'local' }`, na sessão do responsável.

## Driving it

```bash
scripts/verify/scripts/drive.sh edit-delete-sent-message
```

- Mensagem enviada: `getByRole('region', { name: 'Conversa', exact: true }).getByRole('listitem', { name: 'Mensagem enviada' })`.
- Recusa da próxima alteração: `t.phone(setor).failNextChange('refused' | 'uncertain')`.

## Gotchas

- A jornada chama a API, sem passar pela tela: o aviso no lugar do conteúdo ocultado e as etiquetas são provados em `edit-delete-messages-chamados`.
- O adaptador falso não prova o WhatsApp real: a edição de legenda e a revogação reais são `[manual]`.

## Estado final observável

- **`messages`:** a primeira com o texto editado e o apelido do envio, `deletion_scope = 'everyone'`, `deletion_origin = 'agent'`; a segunda com `deletion_scope = 'local'`.
- **`message_actions`:** `edit:refused`, `edit:accepted`, `delete_everyone:accepted`, `delete_local:accepted`.
- **`message_changes`:** original, edição e exclusão da primeira, todas com origem `agent`.
- **`audit_logs`:** `message_edited` e `message_deleted` na entidade `message`.
