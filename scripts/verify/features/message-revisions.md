# Edições e exclusões feitas fora do XET

O cliente, ou o celular do setor, edita ou apaga para todos uma mensagem que o XET já tem. O XET guarda a versão original e cada versão, marca a exclusão sem apagar o conteúdo e não cria mensagem nem chamado novos (#291, spec #290). As etiquetas "Editada" e "Excluída" e o menu estão na #293 (jornada `edit-delete-messages-chamados`); o histórico de versões em Atendimentos está na jornada `atendimentos-message-revisions` (#294).

## Sub-features

- [jornada] A edição do cliente troca o texto da mesma mensagem na conversa aberta, sem recarregar e sem mensagem nova.
- [jornada] Reentrega da mesma edição e edição atrasada não mudam a versão atual.
- [jornada] Exclusão para todos pelo cliente mantém o conteúdo conhecido na conversa.
- [jornada] O banco guarda a original, cada versão e a exclusão, com origem.
- [não coberto] Edição de legenda, edição e exclusão pelo celular do setor, evento antes da original, chamado encerrado e isolamento por setor (testes de integração em `backend/internal/helpdesk/message_changes_test.go`).
- [manual] Edição e exclusão feitas num celular real chegando pelo Whatsmeow.

## How to get to it

1. Uma mensagem do cliente chega e o atendente assume o chamado em `/chamados/<id>`.
2. O cliente edita ou apaga a mensagem no WhatsApp. A conversa recebe o aviso do chamado e recarrega.

## Driving it

```bash
scripts/verify/scripts/drive.sh message-revisions
```

- Mensagem recebida: `getByRole('region', { name: 'Conversa', exact: true }).getByRole('listitem', { name: 'Mensagem recebida' })`.
- Edição: `t.phone(setor).edit(contato, idDaMensagem, texto, { externalEventId, fromSector, at })`.
- Exclusão: `t.phone(setor).revoke(contato, idDaMensagem, { externalEventId, fromSector, at })`.

## Gotchas

- Esta jornada prova o conteúdo mostrado e o estado no banco; as etiquetas "Editada" e "Excluída" são provadas em `edit-delete-messages-chamados`.
- `at` antigo (`2000-01-01`) simula o evento atrasado: fica como versão, antes até da original, e não vira o texto atual.
- O adaptador falso não prova o WhatsApp real: a tradução do Whatsmeow tem teste próprio, mas a entrega real é `[manual]`.

## Estado final observável

- **Tela:** uma só mensagem recebida, com o texto da última edição, depois de recarregar.
- **`messages`:** uma linha, `body` com a última versão, `edited_at` preenchido, `deletion_scope = 'everyone'` e `deletion_origin = 'customer'`.
- **`message_changes`:** a edição atrasada, a original, a edição e a exclusão, nessa ordem de horário.
- **`tickets`:** um só chamado no setor.
