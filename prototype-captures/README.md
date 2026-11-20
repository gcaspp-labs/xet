# Protótipo #309 — proposta para aprovação

Branch: `prototype/309` (protótipo descartável, dados fictícios). Tela Chamados, só desktop.

Execute o frontend da branch em uma porta livre, com `BACKEND_URL` apontando para uma porta sem serviço, e abra `/chamados?prototype=309&estado=fim&tema=claro`. A barra inferior simula uma mensagem recebida, rola para cima e troca o tema. Fora das capturas, os parâmetros de estado são `estado=fim|rolado|contador`, `tema=claro|escuro|contraste` e `captura=1` (esconde a barra).

O que a proposta mostra: com a conversa no fim, nenhum botão; rolada para cima, um botão circular com seta para baixo no canto inferior direito da área de mensagens, 16 px das bordas, sobre o último balão e sem cobrir o campo de mensagem; cada mensagem recebida com a conversa fora do fim soma 1 no contador, em etiqueta presa ao canto superior direito do botão (acima de 99, `99+`); clicar no botão desce até a última mensagem e o botão some. Enviar pelo compositor, abrir outro chamado ou chegar ao fim rolando zera o contador. Avisos do sistema continuam na conversa como hoje e não contam.

O botão é `outline` (superfície com borda `line` e sombra de camada flutuante), como as demais camadas flutuantes do design system, e não o primário, que já é o "Enviar" do compositor. Ícone `ArrowDown` de 17 px com traço 1,7, botão de 36 px, raio de pílula (mesma ideia do WhatsApp Web), nome acessível "Ir para a última mensagem" ou "Ir para a última mensagem, 3 novas".

Capturas desktop: `309-rolado-claro.png` e `309-rolado-escuro.png` (botão sem contador), `309-contador-claro.png`, `309-contador-escuro.png` e `309-contador-contraste.png` (botão com 3 novas), `309-no-fim-claro.png` e `309-no-fim-escuro.png` (no fim, sem botão).

Laboratório, a proposta atende ou o que gostaria de mudar?
