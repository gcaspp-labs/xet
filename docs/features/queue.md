# Recebimento e distribuição

Como as mensagens viram chamados na fila do setor e como alguém assume. Inclui o painel, a tela Chamados, onde o atendente atende e assume novos chamados pela Fila, e os atendimentos realizados no dia.

## Regras

1. Um novo chamado, criado por uma mensagem recebida, entra na fila do setor correspondente ao número que recebeu a mensagem.
2. Um atendente assume o chamado manualmente. Não há distribuição automática.
3. Quando dois atendentes tentam assumir o mesmo chamado ao mesmo tempo, só um consegue.
4. O sistema registra o responsável, que conduz a conversa. Cada chamado tem um único responsável por vez.
5. Os outros integrantes autorizados do setor veem o chamado e quem é o responsável.
6. Um atendente pode assumir vários chamados ao mesmo tempo, sem limite. O painel mostra a quantidade de chamados ativos de cada atendente, sem impedir novas atribuições.
7. Ao assumir pelo painel, o chamado abre em seguida na tela Chamados. A linha inteira de um chamado da fila ou em atendimento no painel também abre o chamado na tela Chamados.
8. Ao assumir pelo sino de notificações ou pela lista "Chamados do setor" da tela do chamado, a tela não muda e aparece o aviso "Chamado assumido" com o link "Abrir chamado", sem interromper o chamado aberto nem o texto em digitação. O link "Abrir chamado" do aviso do sino abre o chamado assumido na tela Chamados, em qualquer tela onde o sino aparece.
9. Na tela Chamados, encerrar, devolver à fila, transferir para outro atendente, transferir para outro setor e cancelar levam de volta à tela Chamados, sem chamado aberto. Na tela do chamado, encerrar, transferir para outro setor, cancelar e devolver à fila levam ao painel. Em ambas, a correção continua na mesma tela.
10. O painel mostra os realizados hoje: os atendimentos do setor encerrados no dia, no horário de Brasília e pelo momento real do encerramento, com "Você" nos próprios.
11. Nos realizados hoje, transferidos para outro setor e cancelados aparecem identificados, e cada linha abre o chamado. O administrador vê o setor escolhido no painel.
12. Fora do expediente, as mensagens entram na fila normalmente, sem resposta automática.
13. Mensagens de grupos do WhatsApp são ignoradas e não geram chamados.
14. Mensagens enviadas direto pelo celular do setor, fora do sistema, entram no chamado do contato com a marcação "enviada fora do sistema", sem atendente identificado. Sem chamado aberto, cria-se um na fila do setor.
15. Uma mensagem recebida depois do encerramento cria um chamado novo, preservando os anteriores no histórico.
16. Mensagens de tipos não suportados (figurinhas, reações, localização) aparecem no histórico como aviso ("tipo de mensagem não suportado"), sem se perder.
17. Cada chamado tem um protocolo no formato ano e sequência (2026-000123), visível só para a equipe.
18. A tela Chamados é onde o atendente atende. Aparece no menu Helpdesk, logo abaixo de Atendimentos, para atendente, supervisor e administrador, e o item fica ativo em toda a tela, com ou sem chamado aberto. Funciona também com o menu recolhido (ícone com dica) e no menu do celular. Na tela do chamado, o item ativo do menu continua sendo Atendimentos.
19. A coluna da esquerda, "Meus chamados", lista só os chamados em atendimento dos quais o usuário é o responsável, com a quantidade no título. Cada item mostra contato, última mensagem, horário e protocolo; a ordem é pela atividade mais recente. Clicar em um item abre o chamado no centro, sem sair da tela, e o item aberto fica destacado. Supervisor e administrador veem a mesma coluna, também só com os chamados deles.
20. Sem chamado aberto, o centro da tela diz "Selecione um atendimento" quando há chamados na coluna da esquerda, e "Sem atendimentos disponíveis" quando não há. A coluna vazia diz "Você não tem atendimentos ativos".
21. O painel da direita tem as abas Fila e Assuntos, e a Fila abre por padrão. A aba Assuntos só aparece com um chamado aberto e para quem pode encerrar aquele chamado, com a consulta de assuntos e soluções do setor descrita em [subjects.md](subjects.md). Detalhes, Notas, Histórico e "Falou com" não aparecem nessa tela; o link "Ver chamado" no topo da conversa abre a tela do chamado, que os mantém. Trocar de chamado volta o painel para a Fila.
22. A aba Fila lista os chamados à espera de atendimento, com contato, última mensagem, horário, protocolo, órgão e o botão Assumir. Atendente e supervisor veem a fila do próprio setor; o administrador, a de todos os setores, inclusive os inativos. Ao assumir, o chamado sai da Fila, entra em "Meus chamados" e o chamado abre na hora. Se outra pessoa assumiu antes, aparece o aviso de sempre e o chamado sai da Fila.
23. Com a aba Assuntos aberta, a aba Fila mostra o número de chamados à espera, no estilo do contador do sino. Ele muda quando chegam chamados ou outra pessoa assume, e some quando chega a zero.
24. Com um chamado da fila aberto na tela Chamados (por exemplo, vindo do painel), o topo da conversa também oferece o botão Assumir.
25. No topo da conversa, Encerrar é a ação principal. Devolver à fila, Transferir e Outro setor são secundárias, e Cancelar chamado é a ação destrutiva, separada das demais. Cada ação só aparece para quem pode fazê-la, como na tela do chamado.
26. A busca da aba Assuntos na tela Chamados não é guardada por chamado: o mesmo texto vale para todos os chamados da visita. Ao trocar de chamado, o painel volta para a Fila.

## Fora do escopo / limites conhecidos

- A Fila do administrador deverá mostrar apenas setores ativos: [#153](https://github.com/gcaspp-labs/xet/issues/153).
- A busca de Assuntos deverá ser guardada por chamado durante a navegação, como na tela do chamado: [#154](https://github.com/gcaspp-labs/xet/issues/154).
- O tratamento de grupos será reavaliado com base no uso real.
- O uso do celular do setor para atender deve ser evitado.
- A tela Chamados não tem filtro nem busca na coluna da esquerda ou na Fila, e o login continua levando ao painel.
- Etiquetas, exibição de reações, figurinhas e localização, e mensagens editadas ou apagadas pelo cliente ficam fora do piloto.

## Relacionado

- Interface: [conversation.md](conversation.md) (balões, Ver chamado), `design.md` (layout da tela Chamados).
- Dados: `tickets`, `messages`, `protocol_counters`, ciclo de vida do chamado. ADRs: 0003.

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Recebimento e distribuição; Usuários e acesso).
- 2026-11-12: regras 18 a 26 acrescentadas (tela Conversas); regras 7, 8 e 9 alteradas. A regra 7 dizia "Ao assumir pelo painel, a conversa abre em seguida. A linha inteira do chamado no painel também abre a conversa."; a regra 8, "Ao assumir pela lista "Conversas do setor" ou pelo sino de notificações, a tela não muda e aparece o aviso "Chamado assumido" com o link "Abrir conversa", sem interromper a conversa atual nem o texto em digitação."; a regra 9, "Encerrar, transferir para outro setor, cancelar e devolver à fila levam de volta ao painel; a correção continua na mesma tela."; mudança da spec #144, PRs #151 e #152. As decisões pendentes de implementação estão em limites conhecidos.
- 2026-11-13: regra 8 alterada. Dizia "O link "Abrir conversa" do aviso do sino abre a tela do chamado assumido."; decisão de Laboratório de 12/11/2026, ticket [#155](https://github.com/gcaspp-labs/xet/issues/155) (spec #144). Saiu dos limites conhecidos o item do link do sino.
- 2026-11-14: nomes da interface padronizados, só texto (ticket [#185](https://github.com/gcaspp-labs/xet/issues/185)): a tela Conversas passa a Chamados, a coluna "Meus atendimentos" a "Meus chamados", o menu Atendimento a Atendimentos, a lista "Conversas do setor" a "Chamados do setor" e o link "Abrir conversa" a "Abrir chamado" (regras 1, 3, 7, 8, 9, 18 a 22, 24 e 26). Nenhuma regra mudou de comportamento; as linhas anteriores ficam como foram escritas.
