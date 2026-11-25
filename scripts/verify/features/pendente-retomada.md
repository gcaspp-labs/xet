# Chamado pendente e retomada por mesclagem

O atendente para um chamado sem encerrá-lo: ele vai para a aba **Pendentes**, o contato fica livre para abrir um chamado novo, e a retomada pelo chamado novo junta as mensagens dos dois num só atendimento (spec #332).

## Sub-features

- [jornada] O responsável coloca o chamado como pendente pelo menu ⋯, com motivo obrigatório; o chamado sai de Meus chamados e volta para a lista sem chamado aberto.
- [jornada] A aba Pendentes do setor traz contato, protocolo, motivo, quem marcou, há quanto tempo e o botão Retomar chamado.
- [jornada] O supervisor vê o pendente no quadro Pendentes do Dashboard, com a quantidade, os 10 mais antigos, e o "Ver todos" que abre `/chamados?aba=pendentes` (ver [dashboard.md](../../../docs/features/dashboard.md), regra 24).
- [jornada] O pendente não recebe mensagem: o cliente que volta a escrever abre um chamado novo na Fila.
- [jornada] Assumido o chamado novo, o aviso no topo da conversa diz quantos pendentes o contato tem e oferece o Retomar chamado.
- [jornada] A janela Retomar chamado explica a mesclagem e lista os pendentes do contato com protocolo, motivo e quem marcou, já com o primeiro escolhido.
- [jornada] O pendente abre no lugar do chamado novo, com as mensagens dos dois na ordem do tempo, o registro de quando ficou pendente (com o motivo) e o de que voltou a partir do chamado novo.
- [jornada] O chamado novo sai em Atendimentos como Mesclado, com o link "Ver chamado <protocolo>" para o original, que abre em Chamados porque voltou a estar em atendimento.
- [jornada] No banco: A em atendimento com as duas mensagens, B encerrado como `merged` apontando para A, e a auditoria `ticket_pending`, `ticket_resumed_by_merge` (com o protocolo de B) e `ticket_merged` (com o destino).
- A segunda jornada da spec #332, encerrar o chamado novo e mesclá-lo no pendente pela correção em Atendimentos, está em [mesclar-encerrado-em-pendente.md](mesclar-encerrado-em-pendente.md).
- [não coberto] Recusas (retomar sem permissão, pendente de outro contato ou setor, chamado devolvido à fila antes do retomar) e a atualização ao vivo para quem só assiste: ficam nos testes de `frontend/e2e/pendente.spec.ts`.
- [não coberto] Aviso de pendentes no sino de notificações, que está fora do escopo da spec #332.

## How to get to it

1. Entre como atendente do setor, abra um chamado da Fila, assuma e escolha **Colocar como pendente** no menu ⋯.
2. A aba **Pendentes**, na coluna da direita de Chamados, lista o chamado. Como supervisor, o mesmo pendente aparece no quadro **Pendentes** do Dashboard.
3. O cliente volta a escrever: o chamado novo entra na Fila. Assuma-o e use **Retomar chamado** no aviso do topo da conversa.
4. O pendente abre com as mensagens dos dois. Em **Atendimentos**, o chamado novo aparece como **Mesclado**, com o link para o original.

## Driving it

```bash
scripts/verify/scripts/drive.sh pendente-retomada
```

- O setor nasce conectado ao adaptador falso (`t.seedSector`), então as mensagens do cliente abrem chamados de verdade no banco da execução.
- A Fila e a aba Pendentes são abas do painel `getByRole('region', { name: 'Fila, assuntos e pendentes' })`; a aba fechada não entra na árvore de acessibilidade, e por isso a linha do contato pode ser procurada direto no painel.
- O pendente é criado pela tela (assumir, menu ⋯, janela), e o chamado novo nasce do `t.phone(setor).receive(...)` com o mesmo contato; o id de B sai do `t.sql`, porque a entrega devolve o id da mensagem.
- O quadro do Dashboard é `getByRole('region', { name: /^Pendentes/ })`: o nome acessível inclui a quantidade, como "Pendentes (1)".
- A ordem das mensagens é conferida pela posição vertical (`boundingBox().y`), como nos testes de tela.

## Gotchas

- O Dashboard só abre para supervisor e administrador; a jornada usa a sessão do supervisor do setor, que vê o recorte do próprio setor.
- Enquanto o pendente está pendente **e** o contato tem chamado novo aberto, o contato aparece nas duas abas; é por isso que se procura a linha na aba aberta, e não na tela toda.
- O aviso de pendentes é um `[data-slot="alert"]` dentro da conversa, e não um `role="alert"` da página: `getByRole('alert')` pega outra coisa (os avisos de erro da fila).
- Um chamado pendente não recebe mensagem nem aceita envio, edição, exclusão ou reação; a mensagem do cliente sempre abre um chamado novo na Fila.
- O link do mesclado aponta para `/chamados/<A>` enquanto A está em atendimento e para `/atendimentos/<A>` depois de encerrado (`lib/tickets.ts`, `ticketPath`).

## Estado final observável

- **Tela:** a aba Pendentes e o quadro do Dashboard com o chamado e o motivo; a janela Retomar chamado; a conversa de A com as mensagens dos dois na ordem do tempo e os registros de pendente e de retomada; a lista de Atendimentos com B como Mesclado e o link para A.
- **`tickets`:** A `in_progress` com o atendente que retomou e as 2 mensagens; B `closed`/`merged` com `merged_into_ticket_id` = A e nenhuma mensagem (as duas passaram para A).
- **`audit_logs`:** em A, `ticket_pending` e `ticket_resumed_by_merge` (com `merged_protocol` do chamado novo); em B, `ticket_merged` (com `merged_into_ticket_id` e os ids das mensagens movidas).
