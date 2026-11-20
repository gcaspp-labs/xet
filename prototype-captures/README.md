# Protótipo #325 — cartão de contato na conversa e prévia "👤 Nome"

Branch: `prototype/325` (protótipo descartável, dados fictícios, só desktop). Tela Chamados e
detalhe de Atendimentos.

## Como abrir

Suba o frontend da branch em uma porta livre, com `BACKEND_URL` apontando para uma porta sem
serviço, e abra:

```bash
cd frontend && BACKEND_URL=http://127.0.0.1:9 npm run dev -- --port 5325
```

`http://localhost:5325/chamados?prototype=325&cenario=cartoes&tema=claro`

Fora das capturas, a barra inferior troca o cenário e o tema. Parâmetros:

- `cenario=cartoes|falha|leitura|atendimentos`
- `tema=claro|escuro|contraste`
- `captura=1` esconde a barra inferior

## A proposta

Uma versão só, porque é ajuste na conversa que já existe. Os balões continuam os de hoje: o cartão
é o conteúdo novo dentro deles.

- **Cartão recebido:** painel `muted` com borda `line-soft` dentro do balão `card`. Ícone de
  contato em círculo, nome em `body-strong`, órgão com o município em `caption` (`ink-soft`) e cada
  telefone em `mono-num` com o botão de copiar ao lado. Com mais de um telefone, cada um na sua
  linha e com o seu botão.
- **Vários contatos numa mensagem:** os cartões ficam empilhados no mesmo balão, com 6 px entre
  eles, todos com a mesma largura (18 rem), e um único horário no pé do balão. Sem rótulo "3
  contatos": a pilha já diz.
- **Cartão enviado:** o mesmo painel, mas em `card` sobre o balão `accent`, que é como o cliente
  recebe. Sem botão de copiar, porque no enviado o telefone é o que saiu, não uma ação. A situação
  de entrega e o horário ficam no pé do balão, como nas outras mensagens; com falha, o motivo e o
  `Reenviar` aparecem como hoje.
- **Telefone em corpo de texto (`mono-num`), não em `caption` como no `PhoneCopy`:** aqui o
  telefone é o conteúdo do cartão, não a legenda de uma ficha. A ação é a mesma (botão `ghost` de
  24 px, ícone `Copy`, aviso "Telefone copiado"). Sugestão para a implementação: extrair o
  `copyPhone` e o botão do `PhoneCopy` (ou dar um tamanho a ele) em vez de duplicar.
- **Nome acessível do botão:** "Copiar telefone +55 (19) 98888-1234", com o número, para dois
  telefones do mesmo contato não terem o mesmo nome no leitor de tela. O grupo do cartão tem
  "Contato: Nome, telefone".
- **Prévia das listas:** "👤 Nome do contato" no lugar do texto, em "Meus chamados" e na Fila,
  também quando o cartão é o enviado. Vale para a última mensagem; a lista não muda em nada além
  disso.
- **Somente leitura:** no detalhe de Atendimentos e para o colega do setor que não é o responsável,
  os cartões aparecem inteiros, com o copiar telefone (não é ação de envio), e o compositor dá
  lugar ao aviso de só leitura de hoje. "Reenviar", reagir, responder e excluir continuam sendo só
  do responsável.
- **Contatos antigos:** seguem "Tipo de mensagem não suportado", sem conversão.

## Contraste (tokens, sem cor fixa)

| Onde | Claro | Escuro | Alto contraste |
| --- | --- | --- | --- |
| Nome e telefone (`ink` sobre `muted`) | 16,1:1 | 13,6:1 | 19,0:1 |
| Órgão (`ink-soft` sobre `muted`) | 7,0:1 | 5,8:1 | 14,0:1 |
| Situação do enviado (`on-accent` sobre `accent`) | 10,0:1 | 7,4:1 | 10,0:1 |

No alto contraste o cartão enviado inverte junto com o balão (painel `card` escuro sobre `accent`
claro), sem `#fff` nem cor fixa.

## Capturas (1440×1000, dados fictícios)

- `325-cartoes-claro.png` — recebido com um contato, recebido com três, enviado com "Lida", prévias
  "👤 Nome" em Meus chamados e na Fila.
- `325-cartoes-escuro.png`, `325-cartoes-contraste.png` — os mesmos cartões nos outros temas.
- `325-copiado-claro.png` — cópia pelo teclado, com o foco no botão e o aviso "Telefone copiado".
- `325-falha-claro.png` — enviado com falha, motivo e "Reenviar"; enviando; contato antigo como
  "Tipo de mensagem não suportado".
- `325-colega-claro.png` — colega do setor: cartões sem ações de envio e o aviso no lugar do
  compositor.
- `325-atendimentos-claro.png` — detalhe de Atendimento encerrado, só leitura.

## O que a implementação precisa resolver

- `MessageType` ganha `contact`, com os cartões da mensagem (nome, telefones, órgão). `mediaLabels`
  em `lib/tickets.ts` é `Record<Exclude<MessageType, 'text'>, string>`: ou o cartão entra lá, ou a
  prévia é tratada antes dele.
- `lastMessagePreview` precisa do primeiro cartão no resumo da última mensagem para escrever "👤
  Nome".
- O cartão recebido é `role="group"` com `aria-label`; os botões de copiar são botões de verdade,
  alcançáveis pelo teclado.
