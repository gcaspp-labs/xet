# Receber e assumir

Mensagem de um contato vira chamado na fila do setor, e uma pessoa do setor assume.

## Sub-features

- [jornada] Mensagem de número desconhecido abre chamado na fila de Chamados, com protocolo, sem recarregar a tela; ao assumir, a conversa avisa "Contato não cadastrado".
- [jornada] Reentrega da mesma mensagem (mesmo `externalMessageId`) não gera efeito.
- [jornada] Segunda mensagem do contato entra no mesmo chamado.
- [jornada] Assumir pela aba Fila de Chamados abre o chamado em `/chamados/<id>`, já com a caixa de resposta, com ou sem outro chamado aberto.
- [jornada] Quem está com a tela desatualizada perde a disputa e recebe o aviso na fila.
- [jornada] Duas pessoas assumindo ao mesmo tempo: uma recebe 200 e a outra 409, com um registro só na auditoria.
- [jornada] O chamado assumido sai da fila e aparece em "Meus chamados".
- [jornada] Pessoa de outro setor não vê a fila e recebe 403 ao pedir o chamado pela API.
- [não coberto] Assumir pela lista da tela do chamado, sem mudar de tela (`conversation.spec.ts`).
- [não coberto] Vários chamados com a mesma pessoa, sem limite (`conversas.spec.ts`).
- [não coberto] Aviso de queda do tempo real e volta automática (`conversas.spec.ts`).
- [não coberto] Grupos ignorados e mensagem enviada pelo celular do setor (só testes de integração).
- [manual] Mensagem real do WhatsApp chegando à fila de Chamados sem recarregar.
- [manual] Mensagem real em grupo não aparece; resposta pelo celular do setor aparece no chamado.

## How to get to it

1. Um contato manda uma mensagem para o número do setor.
2. O atendente entra em `/login` e cai na tela Chamados (`/chamados`). A aba Fila, no cartão "Fila e assuntos", lista os chamados com o contato, o protocolo e a última mensagem.
3. Ele clica em "Assumir" na aba Fila. A tela vai para `/chamados/<id>`, com a conversa e a caixa de resposta.
4. De volta a `/chamados`, o chamado está em "Meus chamados" e fora da Fila. Para outro contato na fila, clica em "Assumir" e também chega a `/chamados/<id>`.

## Driving it

```bash
scripts/verify/scripts/drive.sh receive-and-assign
```

- A mensagem do contato vem do adaptador falso: `t.phone(setor).receive(contato, texto)`, que chama `POST /api/test/messaging/sectors/{id}/receive` e devolve o identificador, para repetir a entrega.
- Fila: `getByRole('region', { name: 'Fila e assuntos' })`, item com `getByRole('listitem').filter({ hasText: 'Nome' })` e botão `getByRole('button', { name: 'Assumir chamado de Nome' })`. Meus chamados: `getByRole('navigation', { name: 'Meus chamados' })`.
- A tela desatualizada vem de `t.signIn(pessoa, { blockRealtime: true })`.
- A disputa simultânea é pela API (`POST /api/tickets/{id}/assign`, em duas sessões, com `Promise.all`), porque cliques não garantem a corrida. As duas sessões são de pessoas reais do setor.

## Gotchas

- O botão mostra só "Assumir" na tela, mas o nome acessível é "Assumir chamado de Nome". Um chamado da fila também abre pelo endereço `/chamados/<id>`, e então o botão principal, no alto, é `{ name: 'Assumir', exact: true }`.
- A fila de Chamados não mostra "Não cadastrado": o aviso do contato sem cadastro está na conversa, depois de abrir o chamado.
- Na disputa simultânea, qualquer das duas pessoas pode ganhar: não confira quantos chamados cada uma tem em "Meus chamados".
- A sessão com `blockRealtime` precisa entrar **depois** de a mensagem chegar: a fila é lida ao abrir a tela e, sem o WebSocket, não muda mais. Entrando antes, ela nunca verá o chamado.
- A rota `receive` não confere se o setor está conectado: a mensagem entra mesmo com o número caído. Não use essa rota como prova de conexão; ela prova o tratamento da mensagem.
- `receive` responde 204 também na reentrega. A prova da idempotência é a contagem no banco, e não a resposta.
- Pré-condição: o setor precisa existir e ter pessoas. Se o `seedSector` falhar, a jornada falha com "Pré-condição não atendida". Não pule o passo.

## Estado final observável

- **Tela:** a Fila sem o contato; "Meus chamados" com o contato; a tela da colega com o aviso "Este chamado já foi assumido por outro atendente."
- **`tickets`:** `status = 'in_progress'`, `assignee_id` da pessoa que assumiu, `assigned_at` preenchido e um só chamado aberto para o contato.
- **`messages`:** duas linhas do contato, apesar da reentrega.
- **`audit_logs`:** um `ticket_assigned` com o autor certo, também no chamado disputado.
