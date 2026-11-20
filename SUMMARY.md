# Verification run-20261120-181811

Commit: 44ec5ec6f4e6be4b42cf208ea0935af4c09d068c. Worktree: clean. Level: journeys.

## Flows

| Flow | Result | Screenshots |
|---|---|---|
| users-list (jornada provisória da #130, fora do mapa; o arquivo está em `users-list/journey.mjs`) | proved (14 passos) | `users-list/` |

Passos: login do administrador pela tela → Configurações › Usuários; página 1 por nome crescente (acento ignorado), tema escuro, página 2 no endereço, Situação decrescente (inativos primeiro, volta à página 1), Setor crescente ("Todos" por último), Papel crescente (Administrador, Atendente, Supervisor), busca "PRADO" (acento e maiúscula ignorados), busca "a" + Setor + página 2 com recarga conservando tudo, mudar a busca volta à página 1 mantendo a ordem, busca sem resultado, Editar a partir da lista, celular 390 px com a legenda "Papel · Setor" e o Editar inteiro na tela. Estado final pela API (`total`, `page`, `pageSize`, sem campo de senha) e pelo banco.

## Comparison with the design

- Desktop (página 1, página 2, ordens, busca, sem resultado, tema escuro): igual às capturas aprovadas no layout, colunas, setas de ordem, SearchBox de 260 px e faixa "Página X de Y · N usuários".
- Celular: no protótipo aprovado o botão Editar ficava fora da tela (a tabela rolava de lado), contra a decisão "Situação e Editar ficam". Na implementação a coluna Usuário encolhe e quebra o e-mail só no celular, e o Editar aparece inteiro.
- Ordem por Papel: o protótipo (API falsa) ordenava Administrador, Supervisor, Atendente; a implementação segue a decisão escrita na issue: pelo rótulo, Administrador, Atendente, Supervisor.
- "Nenhum usuário cadastrado." (captura 06 do protótipo) não aparece no app de verdade: o administrador logado sempre está na lista. O texto existe na tela para o caso sem busca.

## Not proved

- Estado "Nenhum usuário cadastrado." na tela (inalcançável com um administrador logado).

## Errors in the log

none
