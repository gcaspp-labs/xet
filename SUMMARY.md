# Verification run-20261114-041459

Commit: 441341552e11 (ticket/185-padronizar-nomes-chamados). Worktree: clean. Level: journeys.

## Flows

| Flow | Result | Screenshots |
|---|---|---|
| conversas-menu | proved (menu "Chamados", título, fila, resposta e temas) | conversas-menu/ |
| nomes-chamados (provisória, não commitada: `provisional/nomes-chamados.mjs`) | proved: menu Atendimentos/Chamados, "Meus chamados", janela e botão "Novo chamado", aviso "Chamado iniciado", registro "abriu e assumiu o chamado", painel Atendimentos, `ticket_started` no banco | nomes-chamados/ |
| connection | failed: step 9 (igual à main fbb3f74: antes no `heading 'Atendimento'`, agora no `heading 'Atendimentos'`) | connection/ |
| close | failed: igual à main (`region 'Realizados hoje'` não existe na tela inicial do atendente) | close/ |
| transfer | failed: step 2, igual à main (`link 'Joana Cliente'`) | transfer/ |
| reply | failed: step 2, igual à main (`link 'Carla Cliente'`) | reply/ |
| receive-and-assign | failed: step 2, igual à main (`heading 'Atendimento(s)'`) | receive-and-assign/ |
| consult-subjects | failed: step 2, igual à main (`link 'Cecília Consulta'`) | consult-subjects/ |

As seis falhas existem na main fbb3f74, no mesmo passo e com o mesmo localizador (só muda o texto 'Atendimento' → 'Atendimentos'). Causa comum: o atendente cai em `/conversas`, e as jornadas ainda esperam o painel (#179).

## Comparison with the design

Sem seção Design na tarefa; é troca só de texto.

## Not proved

- Chamados antigos mostrando "abriu e assumiu o chamado": a frase é montada pela mesma função para qualquer chamado (`assignmentText`), provado só num chamado novo.
- O que as jornadas com falha na main cobririam depois do ponto em que falham.
- WhatsApp real.

## Errors in the log

Nenhum erro nem panic em `logs/backend.log`.
