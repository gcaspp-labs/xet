# Iniciar conversa

A equipe busca um contato e começa a conversa pelo número do próprio setor. Iniciar já conta como assumir o chamado.

## Regras

1. Qualquer atendente busca um contato e inicia uma conversa pelo número do próprio setor. O administrador escolhe por qual setor iniciar, como no painel.
   _Fonte: migrada do `spec.md` (Iniciar conversas) em 2026-11-11._
2. O contato precisa ter telefone.
   _Fonte: migrada do `spec.md` (Iniciar conversas) em 2026-11-11._
3. Ao enviar a primeira mensagem, cria-se um chamado atribuído a quem iniciou.
   _Fonte: migrada do `spec.md` (Iniciar conversas) em 2026-11-11._
4. Se já existir chamado aberto para o contato no mesmo setor, o sistema direciona para ele. Isso não autoriza outro atendente a responder: continua sendo necessária a transferência.
   _Fonte: migrada do `spec.md` (Iniciar conversas) em 2026-11-11._
5. O chamado aberto é conferido ao escolher o contato. Se ele surgir enquanto a mensagem é escrita (o cliente escreveu ou outro atendente iniciou ao mesmo tempo), a mensagem não é enviada, e o atendente é direcionado ao chamado existente.
   _Fonte: migrada do `spec.md` (Iniciar conversas) em 2026-11-11._
6. A primeira mensagem é um texto; arquivos e áudios seguem pela conversa depois de criado o chamado.
   _Fonte: migrada do `spec.md` (Iniciar conversas) em 2026-11-11._
7. A primeira mensagem segue as regras de envio da conversa: com o número desconectado, o chamado é criado e a mensagem fica com falha, para o responsável reenviar.
   _Fonte: migrada do `spec.md` (Iniciar conversas) em 2026-11-11._
8. Iniciar a conversa conta como assumir o chamado: fica registrado no histórico, e a conversa começa com "Fulano iniciou a conversa e assumiu o chamado".
   _Fonte: migrada do `spec.md` (Iniciar conversas) em 2026-11-11._
9. A tela de nova conversa tem um botão para cadastrar o contato ali mesmo; ao salvar, o novo contato já fica escolhido para a primeira mensagem.
   _Fonte: migrada do `spec.md` (Iniciar conversas) em 2026-11-11._

## Fora do escopo / limites conhecidos

- Com a API oficial, fora da janela de 24 horas só é possível enviar modelos aprovados, o que muda a primeira mensagem (ver `docs/architecture.md`).

## Relacionado

- Dados: `tickets` (`created_by_id`), `audit_logs` (`ticket_started`).

## Histórico

- Nenhuma mudança desde a migração.
