# Conversa

A troca de mensagens com o cliente dentro do chamado: texto, arquivos, áudio, situação de entrega e histórico. Aparece na tela Chamados e no detalhe do atendimento, só para leitura (ver [queue.md](queue.md)).

## Regras

1. Apenas o responsável envia mensagens e arquivos ao cliente, reage a mensagens e responde citando uma mensagem, com o chamado aberto; supervisores e administradores também precisam ser o responsável. Os demais só veem as reações e as citações. Outro atendente precisa receber o chamado por transferência.
2. Toda mensagem enviada pelo sistema, inclusive a primeira de um novo chamado e a resposta citada, leva no início o apelido de quem enviou: "Ana Souza: bom dia". A reação é a exceção: sai sem apelido (regra 21).
3. Anexo com legenda leva o apelido na legenda, e anexo sem legenda tem só "Ana Souza:" como legenda. O áudio sai sem apelido, porque é mensagem de voz, sem legenda. Mensagem enviada pelo celular do setor também fica sem.
4. O painel mostra o mesmo texto que o cliente recebeu, com o apelido. O texto é gravado no envio: "Reenviar" repete o mesmo texto, e trocar o apelido depois não altera as mensagens já gravadas.
5. Arquivos enviados pelo painel têm até 16 MB. Imagens JPEG e PNG vão como imagem, vídeos MP4 como vídeo e os demais como documento, com o nome original.
6. O responsável grava áudio no painel, pode ouvi-lo ou descartá-lo antes de enviar, e o envia como mensagem de voz do WhatsApp, sem legenda e com até 16 MB.
7. Uma gravação que não pode ser lida como áudio é recusada com aviso para gravar de novo.
8. O navegador só libera o microfone com o painel acessado por HTTPS (ou em `localhost`); fora disso, a tela avisa que a gravação está indisponível.
9. Imagens e vídeos, recebidos ou enviados, aparecem com pré-visualização na conversa, e a imagem abre por cima da conversa, com zoom (roda e botões), arrastar e botão para abrir o original em nova guia. Áudios tocam num player no painel. Os demais arquivos abrem ou são baixados pelo link.
10. Arquivos recebidos têm até 100 MB. Arquivo acima do limite, ou que não baixa depois de algumas tentativas, vira mensagem com o aviso "arquivo não pôde ser baixado", sem se perder nem ficar preso em reentrega.
11. Cada mensagem enviada mostra a situação de entrega: enviando, enviada, entregue, lida ou falhou.
12. A situação de entrega só avança: uma confirmação atrasada de entrega não desfaz a leitura, e uma mensagem com falha volta a avançar se o WhatsApp confirmar a entrega.
13. Mensagem que falhou (número desconectado, erro do WhatsApp ou serviço reiniciado durante o envio) não é reenviada automaticamente: o responsável usa "Reenviar", que tenta a mesma mensagem de novo, sem duplicá-la no WhatsApp.
16. O histórico do contato e o do órgão listam os chamados, abertos e encerrados, dos setores a que o usuário tem acesso (todos, para o administrador), do mais recente ao mais antigo.
17. Cada chamado do histórico abre a conversa completa em `/atendimentos/:id`, se estiver encerrado, ou em `/chamados/:id`, se estiver ativo, só para leitura quando o usuário não é o responsável.
18. Na tela Chamados, a área de mensagens tem fundo diferente do cartão, e os balões se distinguem entre si: o enviado em cor de destaque, com texto claro, e o recebido na cor do cartão, com borda. Os avisos do sistema (assumiu, transferiu, encerrou) aparecem com borda tracejada e sem preenchimento, para não parecerem mensagens. O contraste vale nos temas claro, escuro e alto contraste, e no alto contraste o texto tem ao menos 7:1.
19. O campo de mensagem tem um seletor de emojis, com busca pelo nome em português, categorias e uso pelo teclado. O emoji entra na posição do cursor, e a mensagem segue as regras de envio de sempre. Os emojis recebidos do cliente aparecem normalmente no texto.
20. Com o chamado aberto, o responsável reage a uma mensagem do cliente ou do setor com uma barra de seis emojis rápidos (👍 ❤️ 😂 😮 😢 🙏) ou, pelo "+", com qualquer emoji do seletor. Só se reage a mensagem recebida ou enviada que já tenha chegado ao WhatsApp (enviada, entregue ou lida): não a mensagem enviando ou com falha, nem a notas e avisos do sistema. Mensagens exibidas como "tipo de mensagem não suportado" (figurinha, localização) podem receber reação.
21. Cada mensagem tem no máximo duas reações atuais, a do cliente e a do setor, sem histórico de trocas. O setor usa um número só, então tem uma reação por mensagem: a de outro atendente, ou a feita pelo celular do setor, substitui a anterior. Escolher outro emoji troca a reação; tocar no emoji atual a remove. A reação sai para o cliente sem apelido, como qualquer reação do WhatsApp.
22. A reação do setor mostra quem reagiu por último: o apelido do atendente ou "Setor, pelo celular", quando veio do celular do setor. A do cliente aparece como "Cliente". As duas ficam embaixo da mensagem, ficam gravadas e continuam visíveis depois de recarregar a página, no chamado aberto e no detalhe do atendimento.
23. A reação do responsável aparece na hora. Se o envio falhar, ela é desfeita na tela (volta a anterior, se havia) e aparece o aviso "Não foi possível enviar a reação. Tente de novo.". Não há nova tentativa automática nem "Reenviar" para reação.
24. A reação do cliente (ou a troca ou remoção dela) aparece sozinha na conversa aberta, sem sino nem alerta do navegador, no lugar do aviso "tipo de mensagem não suportado". Se a mensagem reagida é de um chamado já encerrado ou não está no XET, a reação é descartada: não grava, não cria chamado e não aparece.
25. Com o chamado aberto, o responsável responde citando uma mensagem do chamado atual, pelo botão Responder da mensagem. Cita texto, áudio, imagem, vídeo e arquivo (inclusive arquivo que não pôde ser baixado); não cita notas, avisos do sistema, mensagens não suportadas, nem mensagem enviando ou com falha. A citação em preparo aparece acima do campo de mensagem e pode ser cancelada antes de enviar. Texto, imagem, arquivo e áudio podem ir como resposta citada.
26. A citação aparece acima da mensagem que a usa, nas enviadas e nas recebidas, e continua visível depois de recarregar. Citação de mídia mostra o tipo e o nome ou a legenda (por exemplo "🎤 Áudio", "📎 contrato.pdf"), sem tocar o áudio nem abrir o arquivo. O cliente vê, no WhatsApp, a resposta citando a mensagem dele.
27. Quando o cliente cita uma mensagem que está no chamado, a citação se liga a ela. Se a mensagem não está no chamado (é de antes do XET ou de outro chamado), mostra o trecho que vem do WhatsApp, com a indicação "Trecho do WhatsApp". Sem a mensagem e sem trecho (a API oficial pode não entregá-lo), mostra "Mensagem indisponível".
28. "Reenviar" de uma resposta citada que falhou repete a mesma citação.
29. O seletor de emojis, a barra de reações e o botão Responder funcionam pelo teclado e têm nomes acessíveis.

## Fora do escopo / limites conhecidos

- Não há histórico de trocas de reação, nem mais de uma reação do setor por mensagem.
- O atendente não cita mensagens de chamados anteriores, notas internas nem avisos do sistema, e não reage a eles.
- As reações antigas, gravadas antes como "tipo de mensagem não suportado", continuam como estão, sem conversão.
- Mensagens editadas ou apagadas pelo cliente e a transcrição de áudio ficam de fora.

## Relacionado

- Dados: `messages` (inclui a citação), `message_reactions`, `media_files`. ADRs: 0001, 0003.

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Conversa; Usuários e acesso).
- 2026-11-12: regras 18 e 19 acrescentadas (contraste dos balões e link Ver chamado na tela Conversas); mudança da spec #144, PR #151.
- 2026-11-14: nomes da interface padronizados, só texto (ticket [#185](https://github.com/gcaspp-labs/xet/issues/185)): a tela Conversas passa a Chamados (regras 18 e 19) e a regra 2 cita "novo chamado".
- 2026-11-15: spec [#173](https://github.com/gcaspp-labs/xet/issues/173), PRs [#189](https://github.com/gcaspp-labs/xet/pull/189), [#190](https://github.com/gcaspp-labs/xet/pull/190), [#192](https://github.com/gcaspp-labs/xet/pull/192), [#194](https://github.com/gcaspp-labs/xet/pull/194). Removidas as regras 14 ("Notas internas são escritas por qualquer pessoa com acesso ao setor do chamado, mesmo sem ser o responsável e também em chamado encerrado. Não são enviadas ao cliente, nem editadas ou excluídas."), 15 ("O campo "falou com" é preenchido pelo responsável enquanto o chamado está aberto; depois do encerramento, muda só pela correção.") e 19 ("No topo da conversa, na tela Chamados, "Ver chamado" abre a tela do chamado, com Detalhes, Notas, Histórico e o campo "Falou com", que não aparecem em Chamados."); a regra 17 dizia "Cada chamado do histórico abre a conversa completa, só para leitura quando o usuário não é o responsável."; a regra 18 deixou de citar a tela do chamado, que não mostra mais a conversa de chamado ativo.
- 2026-11-18: regras 1 e 2 alteradas e regras 19 a 29 acrescentadas (seletor de emojis, reações e respostas citadas); spec [#196](https://github.com/gcaspp-labs/xet/issues/196), PRs [#209](https://github.com/gcaspp-labs/xet/pull/209), [#210](https://github.com/gcaspp-labs/xet/pull/210), [#215](https://github.com/gcaspp-labs/xet/pull/215), [#219](https://github.com/gcaspp-labs/xet/pull/219), [#220](https://github.com/gcaspp-labs/xet/pull/220), [#224](https://github.com/gcaspp-labs/xet/pull/224), [#225](https://github.com/gcaspp-labs/xet/pull/225), [#235](https://github.com/gcaspp-labs/xet/pull/235). A regra 1 dizia "Apenas o responsável envia mensagens e arquivos ao cliente, com o chamado aberto; supervisores e administradores também precisam ser o responsável. Outro atendente precisa receber o chamado por transferência."; a regra 2 dizia "Toda mensagem enviada pelo sistema, inclusive a primeira de um novo chamado, leva no início o apelido de quem enviou: \"Ana Souza: bom dia\"."
