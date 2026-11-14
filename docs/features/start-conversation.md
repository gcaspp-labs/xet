# Iniciar conversa

A equipe busca um contato e começa a conversa pelo número do próprio setor. Iniciar já conta como assumir o chamado.

## Regras

1. Qualquer atendente busca um contato e inicia uma conversa pelo número do próprio setor. O administrador escolhe por qual setor iniciar, como no painel.
2. O contato precisa ter telefone.
3. Ao enviar a primeira mensagem, cria-se um chamado atribuído a quem iniciou.
4. Se já existir chamado aberto para o contato no mesmo setor, o sistema direciona para ele. Isso não autoriza outro atendente a responder: continua sendo necessária a transferência.
5. O chamado aberto é conferido ao escolher o contato. Se ele surgir enquanto a mensagem é escrita (o cliente escreveu ou outro atendente iniciou ao mesmo tempo), a mensagem não é enviada, e o atendente é direcionado ao chamado existente.
6. A primeira mensagem é um texto; arquivos e áudios seguem pela conversa depois de criado o chamado.
7. A primeira mensagem segue as regras de envio da conversa: com o número desconectado, o chamado é criado e a mensagem fica com falha, para o responsável reenviar.
8. Iniciar o chamado conta como assumi-lo: fica registrado no histórico, e o chamado começa com "Fulano abriu e assumiu o chamado", em todos os chamados, inclusive os antigos. O banco guarda só a ação `ticket_started`; a frase é montada na tela.
9. A janela "Novo chamado" tem um botão para cadastrar o contato ali mesmo; ao salvar, o novo contato já fica escolhido para a primeira mensagem.

## Fora do escopo / limites conhecidos

- Com a API oficial, fora da janela de 24 horas só é possível enviar modelos aprovados, o que muda a primeira mensagem (ver `docs/architecture.md`).

## Relacionado

- Dados: `tickets` (`created_by_id`), `audit_logs` (`ticket_started`).

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Iniciar conversas).
- 2026-11-14: a janela passa a "Novo chamado", o aviso a "Chamado iniciado" e o registro de sistema a "Fulano abriu e assumiu o chamado" (regras 8 e 9), mostrado também nos chamados antigos; nada no banco muda. Decisão de Laboratório de 14/11/2026, ticket [#185](https://github.com/gcaspp-labs/xet/issues/185). A regra 8 dizia "Iniciar a conversa conta como assumir o chamado: fica registrado no histórico, e a conversa começa com «Fulano iniciou a conversa e assumiu o chamado»."
