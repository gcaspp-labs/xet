# Receber e assumir

Mensagem de um contato vira chamado na fila do setor, e uma pessoa do setor assume.

## Sub-features

- [jornada] Mensagem de número desconhecido abre chamado na fila, com protocolo, marcado como não cadastrado, sem recarregar a tela.
- [jornada] Reentrega da mesma mensagem (mesmo `externalMessageId`) não gera efeito.
- [jornada] Segunda mensagem do contato entra no mesmo chamado.
- [jornada] Assumir pela aba Fila de Conversas e pelo painel Atendimento abre a conversa, já com a caixa de resposta.
- [jornada] Quem está com a tela desatualizada perde a disputa e recebe o aviso na fila.
- [jornada] Duas pessoas assumindo ao mesmo tempo: uma recebe 200 e a outra 409, com um registro só na auditoria.
- [jornada] O chamado assumido sai da fila e aparece em "Em atendimento".
- [jornada] Pessoa de outro setor não vê a fila e recebe 403 ao pedir o chamado pela API.
- [não coberto] Assumir pela lista da tela da conversa, sem mudar de tela (`conversation.spec.ts`).
- [não coberto] Vários chamados com a mesma pessoa, sem limite (`panel.spec.ts`).
- [não coberto] Aviso de queda do tempo real e volta automática (`panel.spec.ts`).
- [não coberto] Grupos ignorados e mensagem enviada pelo celular do setor (só testes de integração).
- [manual] Mensagem real do WhatsApp chegando ao painel sem recarregar.
- [manual] Mensagem real em grupo não aparece; resposta pelo celular do setor aparece no chamado.

## How to get to it

1. Um contato manda uma mensagem para o número do setor.
2. O atendente entra em `/login` e cai no painel "Atendimento". O cartão "Fila do setor" lista os chamados com o contato, o protocolo e a última mensagem.
3. Ele abre Conversas pelo menu e clica em "Assumir" na aba Fila. A tela vai para `/conversas/<id>`, com a conversa e a caixa de resposta.
4. De volta ao painel, o chamado está em "Em atendimento", marcado "Você". Para outro contato na fila, clica em "Assumir" no painel e também chega a `/conversas/<id>`.

## Driving it

```bash
scripts/verify/scripts/drive.sh receive-and-assign
```

- A mensagem do contato vem do adaptador falso: `t.phone(setor).receive(contato, texto)`, que chama `POST /api/test/messaging/sectors/{id}/receive` e devolve o identificador, para repetir a entrega.
- Fila: `getByRole('region', { name: 'Fila do setor' })`, linha com `getByRole('row', { name: /Nome/ })` e botão `getByRole('button', { name: 'Assumir chamado de Nome' })`.
- A tela desatualizada vem de `t.signIn(pessoa, { blockRealtime: true })`.
- A disputa simultânea é pela API (`POST /api/tickets/{id}/assign`, em duas sessões, com `Promise.all`), porque cliques não garantem a corrida. As duas sessões são de pessoas reais do setor.

## Gotchas

- O botão mostra só "Assumir" na tela, mas o nome acessível é "Assumir chamado de Nome". Na tela da conversa, o botão principal é `{ name: 'Assumir', exact: true }`.
- A sessão com `blockRealtime` precisa entrar **depois** de a mensagem chegar: a fila é lida ao abrir a tela e, sem o WebSocket, não muda mais. Entrando antes, ela nunca verá o chamado.
- A rota `receive` não confere se o setor está conectado: a mensagem entra mesmo com o número caído. Não use essa rota como prova de conexão; ela prova o tratamento da mensagem.
- `receive` responde 204 também na reentrega. A prova da idempotência é a contagem no banco, e não a resposta.
- Pré-condição: o setor precisa existir e ter pessoas. Se o `seedSector` falhar, a jornada falha com "Pré-condição não atendida". Não pule o passo.

## Estado final observável

- **Tela:** "Fila do setor" sem o contato; "Em atendimento" com o contato e "Você"; a tela da colega com o aviso "Este chamado já foi assumido por outro atendente."
- **`tickets`:** `status = 'in_progress'`, `assignee_id` da pessoa que assumiu, `assigned_at` preenchido e um só chamado aberto para o contato.
- **`messages`:** duas linhas do contato, apesar da reentrega.
- **`audit_logs`:** um `ticket_assigned` com o autor certo, também no chamado disputado.
