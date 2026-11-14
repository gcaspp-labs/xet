# Conversa

A troca de mensagens com o cliente dentro do chamado: texto, arquivos, áudio, situação de entrega, notas internas e histórico. Aparece na tela Chamados (ver [queue.md](queue.md)) e na tela do chamado.

## Regras

1. Apenas o responsável envia mensagens e arquivos ao cliente, com o chamado aberto; supervisores e administradores também precisam ser o responsável. Outro atendente precisa receber o chamado por transferência.
2. Toda mensagem enviada pelo sistema, inclusive a primeira de um novo chamado, leva no início o apelido de quem enviou: "Ana Souza: bom dia".
3. Anexo com legenda leva o apelido na legenda, e anexo sem legenda tem só "Ana Souza:" como legenda. O áudio sai sem apelido, porque é mensagem de voz, sem legenda. Mensagem enviada pelo celular do setor também fica sem.
4. O painel mostra o mesmo texto que o cliente recebeu, com o apelido. O texto é gravado no envio: "Reenviar" repete o mesmo texto, e trocar o apelido depois não altera as mensagens já gravadas.
5. Arquivos enviados pelo painel têm até 16 MB. Imagens JPEG e PNG vão como imagem, vídeos MP4 como vídeo e os demais como documento, com o nome original.
6. O responsável grava áudio no painel, pode ouvi-lo ou descartá-lo antes de enviar, e o envia como mensagem de voz do WhatsApp, sem legenda e com até 16 MB.
7. Uma gravação que não pode ser lida como áudio é recusada com aviso para gravar de novo.
8. O navegador só libera o microfone com o painel acessado por HTTPS (ou em `localhost`); fora disso, a tela avisa que a gravação está indisponível.
9. Imagens e vídeos, recebidos ou enviados, aparecem com pré-visualização na conversa, e a imagem abre em tamanho real numa nova aba. Áudios tocam num player no painel. Os demais arquivos abrem ou são baixados pelo link.
10. Arquivos recebidos têm até 100 MB. Arquivo acima do limite, ou que não baixa depois de algumas tentativas, vira mensagem com o aviso "arquivo não pôde ser baixado", sem se perder nem ficar preso em reentrega.
11. Cada mensagem enviada mostra a situação de entrega: enviando, enviada, entregue, lida ou falhou.
12. A situação de entrega só avança: uma confirmação atrasada de entrega não desfaz a leitura, e uma mensagem com falha volta a avançar se o WhatsApp confirmar a entrega.
13. Mensagem que falhou (número desconectado, erro do WhatsApp ou serviço reiniciado durante o envio) não é reenviada automaticamente: o responsável usa "Reenviar", que tenta a mesma mensagem de novo, sem duplicá-la no WhatsApp.
14. Notas internas são escritas por qualquer pessoa com acesso ao setor do chamado, mesmo sem ser o responsável e também em chamado encerrado. Não são enviadas ao cliente, nem editadas ou excluídas.
15. O campo "falou com" é preenchido pelo responsável enquanto o chamado está aberto; depois do encerramento, muda só pela correção.
16. O histórico do contato e o do órgão listam os chamados, abertos e encerrados, dos setores a que o usuário tem acesso (todos, para o administrador), do mais recente ao mais antigo.
17. Cada chamado do histórico abre a conversa completa, só para leitura quando o usuário não é o responsável.
18. Na tela Chamados, a área de mensagens tem fundo diferente do cartão, e os balões se distinguem entre si: o enviado em cor de destaque, com texto claro, e o recebido na cor do cartão, com borda. Os avisos do sistema (assumiu, transferiu, encerrou) aparecem com borda tracejada e sem preenchimento, para não parecerem mensagens. O contraste vale nos temas claro, escuro e alto contraste, e no alto contraste o texto tem ao menos 7:1. A tela do chamado mantém as cores anteriores.
19. No topo da conversa, na tela Chamados, "Ver chamado" abre a tela do chamado, com Detalhes, Notas, Histórico e o campo "Falou com", que não aparecem em Chamados.

## Fora do escopo / limites conhecidos

- Nenhum registrado.

## Relacionado

- Dados: `messages`, `media_files`, `internal_notes`. ADRs: 0001, 0003.

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Conversa; Usuários e acesso).
- 2026-11-12: regras 18 e 19 acrescentadas (contraste dos balões e link Ver chamado na tela Conversas); mudança da spec #144, PR #151.
- 2026-11-14: nomes da interface padronizados, só texto (ticket [#185](https://github.com/gcaspp-labs/xet/issues/185)): a tela Conversas passa a Chamados (regras 18 e 19) e a regra 2 cita "novo chamado".
