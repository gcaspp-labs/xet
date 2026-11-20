# Consultar versões e exclusões de mensagens em Atendimentos

No detalhe só leitura do atendimento (`/atendimentos/:id`), o botão da própria mensagem abre as versões conhecidas (original e edições) e a exclusão, com horário, origem, autor quando conhecido e alcance (para todos ou só no XET). O conteúdo preservado continua na conversa, inclusive o que o XET oculta em Chamados. Nada é editado, restaurado ou reenviado por aqui (spec #290, tickets #292 e #294).

## Sub-features

- [jornada] O atendimento encerrado abre em Atendimentos e mostra o conteúdo preservado das mensagens editadas e excluídas, com "Editada" e "Excluída", sem o aviso "Mensagem excluída no XET" que aparece em Chamados.
- [jornada] A janela "Versões e exclusão da mensagem" abre pelo teclado, mostra a original e a atual (marcada "Atual") e a exclusão com o alcance, e fecha devolvendo o foco ao botão.
- [jornada] A alteração e a exclusão feitas fora do XET aparecem com "pelo cliente" e o alcance "Para todos (também no WhatsApp)".
- [jornada] Recarregar mantém o conteúdo, as etiquetas e as versões.
- [jornada] A ficha segue só leitura: sem campo de mensagem e sem as ações de alterar, restaurar, reenviar ou responder.
- [não coberto] Setor sem acesso (a API responde 403), temas claro e escuro e alto contraste, e a ordem completa de edições intercaladas entre o XET e o celular do setor (testes ponta a ponta em `frontend/e2e/atendimentos-message-changes.spec.ts` e `message-edit-delete.spec.ts`, e integração em `backend/internal/helpdesk/message_versions_test.go`).
- [manual] A mesma consulta depois de uma edição ou exclusão real recebida pelo Whatsmeow.

## How to get to it

1. Um atendimento encerrado aparece na lista de Atendimentos.
2. Clicar na linha abre a ficha só leitura em `/atendimentos/<id>`.
3. A mensagem alterada tem o botão "Ver versões", "Ver exclusão" ou "Ver versões e exclusão" no rodapé do balão.

## Driving it

```bash
scripts/verify/scripts/drive.sh atendimentos-message-revisions
```

- Conversa: `getByRole('region', { name: 'Conversa', exact: true })`; os balões são os `listitem` "Mensagem enviada" e "Mensagem recebida".
- O botão fica dentro do balão, com o nome "Ver versões e exclusão".
- Janela: `getByRole('dialog', { name: 'Versões e exclusão da mensagem' })`; as versões têm `data-testid="message-version"` e a exclusão `data-testid="message-deletion"`.

## Gotchas

- Com a janela aberta, o resto da página sai da árvore de acessibilidade (`aria-hidden`): confira o balão por CSS (`li[id^="message-"]`), como nos testes.
- Uma mensagem nunca alterada não tem botão; a exclusão sozinha mostra só a exclusão, sem versão original.
- O conteúdo excluído pelo cliente ou pelo celular do setor nunca é ocultado; o excluído pelo XET é ocultado apenas em Chamados.
- A ficha pertence ao setor do chamado; outro setor recebe o aviso de sempre, sem conversa nem versões.

## Estado final observável

- **Tela:** a mensagem do XET com o texto editado, "Editada" e "Excluída"; a do cliente com o texto editado, "Editada" e "Excluída".
- **`messages`:** a do XET com `edited_at`, `deletion_scope = 'local'` e `deletion_origin = 'agent'`; a do cliente com `deletion_scope = 'everyone'` e `deletion_origin = 'customer'`.
- **`message_changes`:** `original`, `edit` e `deletion` para cada mensagem, na ordem em que aconteceram.
- **`tickets`:** `status = 'closed'` e `closure_type = 'resolved'`.
