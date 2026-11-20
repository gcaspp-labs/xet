# Protótipo #314 — proposta para aprovação

Branch: `prototype/314` (protótipo descartável, dados fictícios). Tela Chamados, só desktop.

Execute o frontend da branch em uma porta livre, com `BACKEND_URL` apontando para uma porta sem serviço, e abra `/chamados?prototype=314&estado=nao-lidas&tema=claro`. A barra inferior simula uma mensagem recebida, marca tudo como lido e troca o tema. Fora das capturas, os parâmetros são `estado=nao-lidas|limpo|aberto`, `tema=claro|escuro|contraste` e `captura=1` (esconde a barra).

O que a proposta mostra, no item de "Meus chamados":

- **Contador junto do horário:** pílula cheia em `accent`, número em `mono-num` de 10,5 px com o fator de texto, 20 px de altura, raio de pílula. Mesma peça que o sino e a aba "Fila" já usam; acima de 99 mostra `99+`.
- **Posição:** o contador fica logo antes do horário, no fim da primeira linha. O nome ocupa o espaço que sobra, então o horário continua encostado à direita e não anda quando o contador aparece; com dígitos tabulares, os contadores ficam alinhados entre os itens.
- **Destaque sem cor:** o contato e a prévia ficam em negrito (`font-semibold`, prévia em `ink` no lugar de `ink-soft`). O protocolo continua em `ink-faint`. Assim o item com não lidas se acha mesmo sem olhar o número.
- **Só com não lidas:** item lido não mostra contador nem negrito; o chamado aberto (com a aba visível) também não mostra, e o contador zera ao abrir.
- **Nome acessível:** o número visível é `aria-hidden` e um texto só para leitor de tela diz "1 mensagem não lida" / "N mensagens não lidas", com o número real (não "99+") — o contador é lido sem duplicar o número.
- **Temas:** claro, escuro e alto contraste só com tokens (`bg-primary` / `text-primary-foreground`, que é `--on-accent` e inverte no tema escuro).

Contraste conferido: claro `#FFFFFF` sobre `#01466F`; escuro `#04131C` sobre `#4BAECE`; alto contraste `#FFFFFF` sobre `#01466F`. Todos acima de 7:1.

Capturas desktop (1440×900): `314-nao-lidas-claro.png`, `314-nao-lidas-escuro.png`, `314-nao-lidas-contraste.png` (contadores 1, 2, 4, 12 e `99+`), `314-aberto-claro.png` (chamado aberto, sem contador), `314-limpo-claro.png` (nenhuma não lida, lista limpa como hoje).

Laboratório, a proposta atende ou o que gostaria de mudar?
