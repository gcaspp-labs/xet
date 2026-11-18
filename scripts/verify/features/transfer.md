# Transferir

O chamado muda de responsável no mesmo setor ou segue para outro setor, sem perder o histórico.

## Sub-features

- [jornada] O colega acompanha, sem poder responder nem transferir (sem o menu "Mais ações").
- [jornada] O responsável transfere para um colega; o destino não oferece o próprio responsável.
- [jornada] Quem transferiu perde a resposta, e a conversa guarda o registro da transferência e o histórico.
- [jornada] O novo responsável passa a responder sem recarregar.
- [jornada] Pela API, o responsável anterior recebe 403.
- [jornada] O supervisor transfere o chamado de outra pessoa.
- [jornada] A transferência para outro setor é sem formulário (setor e motivo opcional, sem exigir cadastro do contato), encerra a origem, cria um chamado na fila do destino e volta a `/chamados` (regra 11 de `docs/features/transfers.md`).
- [jornada] O contato sem cadastro chega ao destino sem órgão (regra 14).
- [jornada] O destino vê "Transferido de ..." e, na conversa, o aviso "transferiu o chamado do setor ... para o setor ..." com o motivo; assume e responde pelo adaptador falso.
- [jornada] A origem, encerrada como transferida, abre a ficha só leitura com o destino na cadeia de transferências, o aviso "transferiu o chamado para o setor ..." com o motivo (regra 18) e sem o botão "Corrigir", mesmo para quem a encerrou.
- [jornada] Cancelado o chamado novo, a ficha do destino traz o chamado anterior (setor, protocolo, quem transferiu e motivo, sem assunto nem resolução), e o link abre a ficha da origem (regra 16).
- [jornada] A auditoria `ticket_transferred_sector` guarda o motivo.
- [não coberto] Devolver à fila (`return.spec.ts`).
- [não coberto] Abrir o chamado anterior pelo destino, sem poder agir nela (`transfer-sector.spec.ts`).
- [não coberto] Contato com órgão principal: o chamado chega ao destino com esse órgão (regra 14; `TestSectorTransferTakesTheMainOrganizationOfTheContact`).
- [não coberto] Transferência sem motivo e quadro de origem de uma transferência antiga, com assunto e resolução (`transfer-sector.spec.ts`).
- [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (`transfer-sector.spec.ts` e testes de integração).
- [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## How to get to it

**No mesmo setor:**

1. Com o chamado assumido, o responsável abre o menu "Mais ações" e escolhe "Transferir".
2. Escolhe a pessoa em "Transferir para" e confirma.
3. O aviso "Chamado transferido" aparece, e ele volta a `/chamados`. Se reabrir o chamado pelo endereço, vê a conversa sem caixa de resposta. Na tela do novo responsável, a caixa aparece sem recarregar.

**Para outro setor:**

1. O responsável abre "Mais ações" e escolhe "Outro setor".
2. Escolhe o setor de destino e, se quiser, escreve o motivo. Não há formulário de encerramento, e o contato não precisa de cadastro.
3. Confirma e volta a `/chamados`. Em Atendimentos, a origem é uma linha do histórico, marcada "Transferido", com "para <setor de destino>".
4. No setor de destino, o chamado está na fila, com a mensagem "Transferido de ..." e, na conversa, o aviso da transferência com o motivo. Quem assume escreve a primeira mensagem ao contato. O chamado da fila só abre pelo endereço `/chamados/<id>`, até alguém assumir.

## Driving it

```bash
scripts/verify/scripts/drive.sh transfer
```

- Mesmo setor: `getByRole('dialog', { name: 'Transferir chamado' })`, com `getByRole('combobox', { name: 'Transferir para' })` e `getByRole('option', { name: /^Nome · Atendente/ })`.
- Outro setor: `getByRole('dialog', { name: 'Transferir para outro setor' })`, com `getByLabel('Setor de destino')` e `getByLabel('Motivo da transferência (opcional)')`.
- Pessoas diferentes ficam em sessões separadas do mesmo navegador, para provar a atualização sem recarregar. A jornada fecha as sessões de que não precisa mais, para poupar memória.

## Gotchas

- O destino lista também o supervisor do setor, com a contagem "0 em atendimento". Quem não é atendente pode receber o chamado; não trate isso como erro.
- Os dois setores precisam estar conectados, ou a resposta do destino falha.
- "Transferir" é um item do menu "Mais ações" e também o botão de confirmar do diálogo: dentro do diálogo, use sempre o botão do próprio `getByRole('dialog', ...)`.
- O "Chamado anterior" só aparece na ficha (`/atendimentos/<id>`), dentro dos detalhes, e a ficha só existe para chamado encerrado. Por isso a jornada cancela o chamado do destino no fim.
- `changes.assignee_id` em `audit_logs` guarda os ids das pessoas, e não os nomes.

## Estado final observável

- **Tela:** a conversa com "X transferiu o chamado para Y" e "Supervisor transferiu o chamado de Y para X"; só o responsável atual com a caixa de resposta; o destino com "Transferido de ..." e o aviso "X transferiu o chamado do setor A para o setor B" com "Motivo: ..."; a ficha da origem com "X transferiu o chamado para o setor B" e "Motivo: ...", sem "Corrigir"; o quadro "Chamado anterior" com setor, protocolo, quem transferiu e motivo, sem assunto nem resolução.
- **`tickets`, mesmo setor:** `in_progress`, com o último destino como responsável e as duas mensagens preservadas.
- **`audit_logs`, mesmo setor:** `ticket_assigned` e dois `ticket_transferred_user`, com autor e `assignee_id` de/para corretos.
- **`tickets`, outro setor:** origem `closed` com `closure_type = 'transferred'`, sem `subject` e com `transfer_reason`; destino com `previous_ticket_id` apontando para a origem e, como o contato não tem cadastro, sem `organization_id`.
- **`audit_logs`, outro setor:** `ticket_transferred_sector` na origem, com `changes.transfer_reason`.
- **`tickets`, destino cancelado no fim:** `closed` com `closure_type = 'cancelled'` e `previous_ticket_id` ainda apontando para a origem.
