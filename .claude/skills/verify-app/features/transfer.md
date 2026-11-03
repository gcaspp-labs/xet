# Transferir

O chamado muda de responsável no mesmo setor ou segue para outro setor, sem perder o histórico.

## Sub-features

- [jornada] O colega acompanha, sem poder responder nem transferir.
- [jornada] O responsável transfere para um colega; o destino não oferece o próprio responsável.
- [jornada] Quem transferiu perde a resposta, e a conversa guarda o registro da transferência e o histórico.
- [jornada] O novo responsável passa a responder sem recarregar.
- [jornada] Pela API, o responsável anterior recebe 403.
- [jornada] O supervisor transfere o chamado de outra pessoa.
- [jornada] A transferência para outro setor exige o formulário, encerra a origem e cria um chamado na fila do destino.
- [jornada] O destino vê a origem e a conversa anterior, assume e responde pelo adaptador falso.
- [não coberto] Devolver à fila (`return.spec.ts`).
- [não coberto] Abrir a conversa anterior pelo destino, sem poder agir nela (`transfer-sector.spec.ts`).
- [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (só testes de integração).
- [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## How to get to it

**No mesmo setor:**

1. Com o chamado assumido, o responsável clica em "Transferir" no alto da conversa.
2. Escolhe a pessoa em "Transferir para" e confirma.
3. O aviso "Chamado transferido" aparece, e a caixa de resposta some da tela dele. Na tela do novo responsável, ela aparece sem recarregar.

**Para outro setor:**

1. O responsável clica em "Outro setor".
2. Preenche assunto, resolução e módulos e escolhe o setor de destino. Se o contato não tiver cadastro, cadastra pelo próprio formulário.
3. Confirma e volta ao painel, com o atendimento em "Realizados hoje", marcado "Transferido".
4. No setor de destino, o chamado está na fila, com a mensagem "Transferido de ...". Quem assume escreve a primeira mensagem ao contato.

## Driving it

```bash
.claude/skills/verify-app/scripts/drive.sh transfer
```

- Mesmo setor: `getByRole('dialog', { name: 'Transferir chamado' })`, com `getByRole('combobox', { name: 'Transferir para' })` e `getByRole('option', { name: /^Nome · Atendente/ })`.
- Outro setor: `getByRole('dialog', { name: 'Transferir para outro setor' })`, com `getByLabel('Setor de destino')`.
- Pessoas diferentes ficam em sessões separadas do mesmo navegador, para provar a atualização sem recarregar. A jornada fecha as sessões de que não precisa mais, para poupar memória.

## Gotchas

- O destino lista também o supervisor do setor, com a contagem "0 em atendimento". Quem não é atendente pode receber o chamado; não trate isso como erro.
- A transferência para outro setor exige contato cadastrado com órgão e ao menos um módulo no setor de origem. Sem isso, o formulário não conclui, e a jornada precisa falhar. Os módulos vêm do `seedSector({ modules })`.
- Os dois setores precisam estar conectados, ou a resposta do destino falha.
- O botão "Transferir" existe no alto da tela e dentro do painel lateral: use sempre o que está dentro do diálogo para confirmar.
- `changes.assignee_id` em `audit_logs` guarda os ids das pessoas, e não os nomes.

## Estado final observável

- **Tela:** a conversa com "X transferiu o chamado para Y" e "Supervisor transferiu o chamado de Y para X"; só o responsável atual com a caixa de resposta; o destino com "Transferido de ...".
- **`tickets`, mesmo setor:** `in_progress`, com o último destino como responsável e as duas mensagens preservadas.
- **`audit_logs`, mesmo setor:** `ticket_assigned` e dois `ticket_transferred_user`, com autor e `assignee_id` de/para corretos.
- **`tickets`, outro setor:** origem `closed` com `closure_type = 'transferred'`; destino com `previous_ticket_id` apontando para a origem.
- **`audit_logs`, outro setor:** `ticket_transferred_sector` na origem.
