# Recebimento e distribuição

Como as mensagens viram chamados na fila do setor e como alguém assume. Inclui o painel e os atendimentos realizados no dia.

## Regras

1. Uma nova conversa recebida entra na fila do setor correspondente ao número que recebeu a mensagem.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
2. Um atendente assume o chamado manualmente. Não há distribuição automática.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
3. Quando dois atendentes tentam assumir o mesmo chamado ao mesmo tempo, só um consegue.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
4. O sistema registra o responsável, que conduz a conversa. Cada chamado tem um único responsável por vez.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
5. Os outros integrantes autorizados do setor veem o chamado e quem é o responsável.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
6. Um atendente pode assumir vários chamados ao mesmo tempo, sem limite. O painel mostra a quantidade de chamados ativos de cada atendente, sem impedir novas atribuições.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
7. Ao assumir pelo painel, a conversa abre em seguida. A linha inteira do chamado no painel também abre a conversa.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
8. Ao assumir pela lista "Conversas do setor" ou pelo sino de notificações, a tela não muda e aparece o aviso "Chamado assumido" com o link "Abrir conversa", sem interromper a conversa atual nem o texto em digitação.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
9. Encerrar, transferir para outro setor, cancelar e devolver à fila levam de volta ao painel; a correção continua na mesma tela.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
10. O painel mostra os realizados hoje: os atendimentos do setor encerrados no dia, no horário de Brasília e pelo momento real do encerramento, com "Você" nos próprios.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
11. Nos realizados hoje, transferidos para outro setor e cancelados aparecem identificados, e cada linha abre o chamado. O administrador vê o setor escolhido no painel.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
12. Fora do expediente, as mensagens entram na fila normalmente, sem resposta automática.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
13. Mensagens de grupos do WhatsApp são ignoradas e não geram chamados.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
14. Mensagens enviadas direto pelo celular do setor, fora do sistema, entram no chamado do contato com a marcação "enviada fora do sistema", sem atendente identificado. Sem chamado aberto, cria-se um na fila do setor.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
15. Uma mensagem recebida depois do encerramento cria um chamado novo, preservando os anteriores no histórico.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
16. Mensagens de tipos não suportados (figurinhas, reações, localização) aparecem no histórico como aviso ("tipo de mensagem não suportado"), sem se perder.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._
17. Cada chamado tem um protocolo no formato ano e sequência (2026-000123), visível só para a equipe.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição; Usuários e acesso) em 2026-11-11._

## Fora do escopo / limites conhecidos

- O tratamento de grupos será reavaliado com base no uso real.
- O uso do celular do setor para atender deve ser evitado.
- Etiquetas, exibição de reações, figurinhas e localização, e mensagens editadas ou apagadas pelo cliente ficam fora do piloto.

## Relacionado

- Dados: `tickets`, `messages`, `protocol_counters`, ciclo de vida do chamado. ADRs: 0003.

## Histórico

- Nenhuma mudança desde a migração.
