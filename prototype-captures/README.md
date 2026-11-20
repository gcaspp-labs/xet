# Protótipo #326 — menu do anexo com "Contato" e janela "Enviar contato"

Branch: `prototype/326` (protótipo descartável, dados fictícios, só desktop). Tela Chamados, com a
conversa aberta.

## Como abrir

Suba o frontend da branch em uma porta livre, com `BACKEND_URL` apontando para uma porta sem
serviço, e abra:

```bash
cd frontend && BACKEND_URL=http://127.0.0.1:9 npm run dev -- --port 5326
```

`http://localhost:5326/chamados?prototype=326&variant=A&estado=busca&tema=claro`

Fora das capturas, a barra inferior troca a versão, o estado e o tema. Parâmetros:

- `variant=A|B|C`
- `estado=menu|busca|previa|enviado`
- `tema=claro|escuro|contraste`
- `captura=1` esconde a barra inferior

## A pergunta

A janela tem três partes: busca no cadastro, lista de resultados e prévia do cartão. Como organizar
essas três numa janela só, sem esconder a lista de quem está comparando homônimos?

| Versão                               | Ideia                                                                                                                                                  | Por que                                                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — duas etapas, uma coluna      | A lista ocupa a janela; escolher um contato troca a lista pela prévia, com `Voltar` para escolher outro. Janela na largura padrão (460 px).            | O caminho mais parecido com o "Novo chamado", que já escolhe contato e mostra o resumo. Uma coisa por vez, cabe no celular sem rolagem lateral.           |
| **B** — duas colunas, prévia ao lado | Janela larga (900 px): busca e lista à esquerda, prévia à direita que acompanha a escolha. `Enviar` no rodapé, desligado enquanto nada está escolhido. | Quem busca "Ana" vê as duas Ana Beatriz e Ana Paula na lista e o cartão da escolhida ao mesmo tempo, sem ir e voltar. A escolha é reversível a um clique. |
| **C** — prévia na própria linha      | Um passo: a linha escolhida abre a prévia ali mesmo, com `Voltar` (recolhe) e `Enviar` dentro dela. A lista continua atrás, como contexto.             | O caminho mais curto para quem já sabe quem quer. Nada troca de lugar na tela, então não se perde a posição na lista.                                     |

Em todas: o rodapé tem `Cancelar` (fecha sem enviar) e o `Enviar` só existe quando há cartão
pronto para sair. No A o `Voltar` fica no rodapé, à esquerda, junto de `Cancelar`.

## O que é comum às três

- **Menu do anexo:** o clipe abre um menu com `Arquivo` (o que já existe) e `Contato`. Fecha com
  Esc, seta e clique fora, como qualquer menu do design system.
- **Busca:** mesma caixa do "Novo chamado" (busca imediata, sem botão) e os mesmos filtros — setor,
  município e órgão — abrindo em **Meu setor**, com "Todos os setores" na lista.
- **Resultados:** uma linha por contato com nome, telefone e órgão com o município, que é o que
  separa dois homônimos. Contatos sem telefone e contatos não cadastrados **não aparecem**: o que
  não pode ser enviado não se oferece. Vazio: "Nenhum contato encontrado."
- **Prévia:** o cartão do #325 (aprovado em 20/11), no formato do enviado — ícone, nome, órgão com
  o município e telefone — com a frase "Sem legenda, como o áudio. O cliente toca para conversar ou
  salvar." O cartão é o mesmo dos dois lados, então a prévia não promete outra coisa.
- **Enviar:** a janela fecha e o cartão entra na conversa com a situação de entrega, no pé do
  balão, como as outras mensagens. O foco volta para o campo de mensagem (é o anel de foco na
  captura `326-enviado-claro`).
- **Quem não é o responsável:** não vê o menu nem a opção `Contato`, porque o clipe que abre o menu
  é o mesmo que só existe para o responsável com o chamado aberto. Nada de novo para desenhar; é a
  regra que já vale.

## Capturas

| Arquivo                      | O que mostra                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `326-menu-claro.png`         | O menu do clipe aberto, com `Arquivo` e `Contato`                                 |
| `326-A-busca-claro.png`      | A — a busca com filtros e a lista                                                 |
| `326-A-busca-ana-claro.png`  | A — "ana" na busca: as duas Ana na lista, com telefone e órgão de cada uma        |
| `326-A-previa-claro.png`     | A — a prévia no lugar da lista, com `Voltar`, `Cancelar` e `Enviar`               |
| `326-B-busca-claro.png`      | B — duas colunas, prévia vazia pedindo a escolha                                  |
| `326-B-previa-claro.png`     | B — duas colunas, contato escolhido e a prévia ao lado                            |
| `326-C-previa-claro.png`     | C — a prévia aberta dentro da linha escolhida                                     |
| `326-enviado-claro.png`      | Depois de enviar: o cartão na conversa, com "Enviada", e o foco de volta no campo |
| `326-A-previa-escuro.png`    | A no tema escuro                                                                  |
| `326-A-previa-contraste.png` | A no alto contraste                                                               |

As capturas saem do `frontend/shot326.mjs` (Playwright, 1360x900).
