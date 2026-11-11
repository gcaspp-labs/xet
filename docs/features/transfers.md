# Transferências

Passar o chamado para outra pessoa do setor, devolvê-lo à fila ou levá-lo a outro setor, sem perder o histórico.

## Regras

1. A transferência muda o responsável e preserva mensagens, registros e contexto, com registro no histórico.
2. Transfere o chamado em atendimento o próprio responsável. Supervisores do setor e administradores também transferem chamados de outros atendentes; o atendente que não é o responsável não transfere.
3. O destino é um atendente ou supervisor ativo do setor do chamado. Administradores não são destino.
4. Chamado na fila não é transferido: é assumido.
5. Depois da transferência, só o novo responsável responde; o anterior passa a ver a conversa apenas para leitura.
6. A conversa mostra, entre as mensagens e na ordem do tempo, quando o chamado foi assumido, cada transferência e o encerramento, com quem fez, de quem para quem e quando.
7. Transferir de novo para quem já é o responsável não muda nada nem gera novo registro.
8. O responsável, os supervisores do setor e os administradores devolvem à fila um chamado em atendimento, por exemplo quando foi assumido por engano.
9. A devolução fica registrada no histórico e aparece na conversa. O momento em que o chamado foi assumido pela primeira vez não muda.
10. Transfere para outro setor só o responsável pelo chamado em atendimento; supervisores e administradores também precisam ser o responsável.
11. Antes de concluir, preenche-se o formulário de encerramento completo (assunto, resolução e módulos), com as regras dele, inclusive o cadastro do contato (ver [closing.md](closing.md)).
12. A etapa do setor de origem é encerrada, e cria-se um chamado novo, ligado ao anterior, na fila do setor de destino.
13. O destino é outro setor ativo. Se o contato já tiver chamado aberto no destino, a transferência é recusada e nada é encerrado.
14. O novo chamado entra na fila do destino com o mesmo contato e o órgão informado no formulário, e chega no momento da transferência.
15. O destino responde pelo próprio número de WhatsApp. A mensagem de abertura sai quando o chamado for assumido, não na transferência, e o atendente do destino a escreve livremente.
16. O chamado do destino mostra a origem (setor, protocolo, assunto, resolução e quem transferiu), com acesso à conversa anterior completa, com notas, só para leitura.
17. Os usuários do destino veem toda a cadeia de chamados anteriores, mas não escrevem notas nem agem neles.
18. O chamado de origem mostra para qual setor e protocolo foi transferido, sem acesso à conversa do destino. A conversa da origem mostra quem transferiu e quando.

## Fora do escopo / limites conhecidos

- Com a API oficial, a primeira mensagem do destino fora da janela de 24 horas precisará ser um modelo aprovado (ver `docs/architecture.md`).

## Relacionado

- Dados: `tickets` (`previous_ticket_id`), `audit_logs` (`ticket_transferred_user`, `ticket_transferred_sector`, `ticket_returned`).

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Transferências › Entre atendentes do mesmo setor; Transferências › Devolver à fila; Transferências › Entre setores).
