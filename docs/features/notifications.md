# Notificações

O sino do cabeçalho e os alertas do navegador avisam dos chamados na fila e dos números desconectados.

## Regras

1. O sino do cabeçalho está em todas as telas. Clicar nele abre a lista; o contador soma os chamados na fila e os números desconectados.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição › Notificações) em 2026-11-11._
2. Cada chamado na fila é um item com o contato, a prévia da última mensagem e os botões "Abrir" e "Assumir".
   _Fonte: migrada do `spec.md` (Recebimento e distribuição › Notificações) em 2026-11-11._
3. O item existe enquanto o chamado estiver na fila, inclusive devolvido ou transferido, e sai quando alguém assume ou cancela. Não há lido nem histórico.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição › Notificações) em 2026-11-11._
4. Atendentes e supervisores veem a fila do próprio setor.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição › Notificações) em 2026-11-11._
5. O administrador não recebe notificação de chamados: não há item, contador, aviso, som nem notificação do navegador. O sino dele mostra só número desconectado, e ele acompanha o atendimento pelo dashboard e pelo painel.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição › Notificações) em 2026-11-11._
6. Ao entrar um chamado na fila, além do contador, aparece um aviso breve, sem botão, para evitar assumir sem querer ao digitar.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição › Notificações) em 2026-11-11._
7. Abrir a tela ou recuperar a conexão não avisa dos chamados que já estavam na fila.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição › Notificações) em 2026-11-11._
8. Número desconectado é um item fixo no topo da lista, só para supervisores e administradores, que leva à tela de conexão do setor.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição › Notificações) em 2026-11-11._
9. O item de número desconectado fica até o número conectar, inclusive enquanto a conexão está em andamento e na própria tela de conexão. Enquanto houver número desconectado, o contador fica na cor de alerta.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição › Notificações) em 2026-11-11._
10. Quem ativar recebe a notificação do navegador com a aba em segundo plano, com o nome do contato e sem o texto da mensagem, e um som curto ao entrar um chamado na fila.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição › Notificações) em 2026-11-11._
11. O título da aba mostra o contador.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição › Notificações) em 2026-11-11._
12. Cada pessoa liga ou desliga os alertas do navegador no menu Configurações, e a escolha fica no navegador. As opções não aparecem para o administrador.
   _Fonte: migrada do `spec.md` (Recebimento e distribuição › Notificações) em 2026-11-11._

## Fora do escopo / limites conhecidos

- Com o sistema fechado, não há aviso.

## Relacionado

- ADRs: 0003 (o sino compara a fila recarregada com a anterior).

## Histórico

- Nenhuma mudança desde a migração.
