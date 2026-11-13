# Verificação run-20261113-145134

Commit: 6af7012ea7cb6fc8ff245a1e5816056a46e445bb. Worktree: clean. Level: journeys.

- Branch: `ticket/160-dashboard-fila-em-atendimento`
- Arquivos sem commit na subida: 0
- Início: 2026-11-13 14:51:36 -0300
- Resumo gerado em: 2026-11-13 14:53:57 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | PASSOU | 12 | `evidence/receive-and-assign/` |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| dashboard-160 (fora do mapa) | PASSOU | 9 | `evidence/dashboard-160/` |

## Fica para a verificação manual ou sem cobertura nestas jornadas

- close: [não coberto] Correção de chamado encerrado (`correction.spec.ts`).
- close: [não coberto] Cancelamento de chamado em atendimento e as permissões do cancelamento (`closing.spec.ts`).
- close: [não coberto] Trocar o órgão só para este chamado, no formulário (`closing.spec.ts`).
- connection: [não coberto] Aparelho que não pôde ser avisado ao desvincular (`connection.spec.ts`).
- connection: [não coberto] Volta da conexão ao reiniciar o serviço (`TestConnectionSurvivesRestart`, só integração).
- connection: [manual] Ler o QR code real com o celular do setor.
- connection: [manual] O QR code real trocando sozinho a cada 20 segundos.
- connection: [manual] O celular mostrando "Central de Atendimento" em vez de "Outro dispositivo".
- connection: [manual] Reiniciar o serviço e ver o número voltar sem novo QR code.
- connection: [manual] Desvincular pelo celular e pela tela, com o aparelho sumindo do celular.
- consult-subjects: [não coberto] Permissão, setor vazio, ausência de resultados e tela estreita (`subjects.spec.ts`).
- conversas-menu: [não coberto] Filtrar e ordenar atendimentos, trocar de conversa e acessar Assuntos (`conversas.spec.ts`).
- conversas-menu: [manual] Receber e responder pelo WhatsApp real.
- receive-and-assign: [não coberto] Assumir pela lista da tela da conversa, sem mudar de tela (`conversation.spec.ts`).
- receive-and-assign: [não coberto] Vários chamados com a mesma pessoa, sem limite (`panel.spec.ts`).
- receive-and-assign: [não coberto] Aviso de queda do tempo real e volta automática (`panel.spec.ts`).
- receive-and-assign: [não coberto] Grupos ignorados e mensagem enviada pelo celular do setor (só testes de integração).
- receive-and-assign: [manual] Mensagem real do WhatsApp chegando ao painel sem recarregar.
- receive-and-assign: [manual] Mensagem real em grupo não aparece; resposta pelo celular do setor aparece no chamado.
- reply: [não coberto] Notas internas, "Falou com" e histórico do contato (`conversation.spec.ts`).
- reply: [não coberto] Áudio gravado, imagens, vídeos e mídias recebidas (`media.spec.ts`).
- reply: [não coberto] Mensagens `pending` marcadas como `failed` ao reiniciar o serviço (só testes de integração).
- reply: [manual] Texto, imagem e PDF chegando ao celular do contato.
- reply: [manual] "Entregue" e "Lida" pelos recibos reais do WhatsApp.
- reply: [manual] Reenvio depois de falha sem duplicar no celular.
- reply: [manual] Áudio gravado chegando como mensagem de voz, com a duração certa.
- transfer: [não coberto] Devolver à fila (`return.spec.ts`).
- transfer: [não coberto] Abrir a conversa anterior pelo destino, sem poder agir nela (`transfer-sector.spec.ts`).
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (só testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Comparação com o design

A versão C mantém as duas listas compactas lado a lado, os tempos, responsável, setor para administrador e a legenda. O menu difere do protótipo porque a #163 já colocou Dashboard fora de Helpdesk; dados e quantidade de linhas são fictícios e diferentes.

A jornada original receive-and-assign falhou na primeira tentativa por esperar a entrada em Atendimento; a #163 passou a iniciar atendentes em Conversas. Uma cópia provisória acessou Atendimento pelo menu e passou todos os passos originais.

## Sinais do backend

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261113-145134/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 16 arquivo(s) em .verify-app/runs/run-20261113-145134/evidence.

## Detalhe de cada jornada

## Jornada dashboard-160: PASSOU

Commit `6af7012ea7cb6fc8ff245a1e5816056a46e445bb`, início 2026-11-13T17:52:54.209Z, duração 4 s.

#### Passos

1. ok: Preparar setor e pessoas (459 ms)
2. ok: Preparar outro setor (438 ms)
3. ok: Preparar chamados fictícios (54 ms)
4. ok: Supervisor vê a fila do próprio setor (192 ms): `01-supervisor-fila.png`
5. ok: Assumir abre Conversas (248 ms): `02-conversa.png`
6. ok: Atendimento e nova fila aparecem ao vivo (302 ms): `03-supervisor-listas.png`
7. ok: Linha abre o chamado (187 ms): `04-chamado.png`
8. ok: Administrador vê os setores e filtra (540 ms): `05-admin-todos-setores.png`, `06-admin-setor.png`
9. ok: Estado final dos chamados (139 ms)

#### Estado final observado

Chamados:

```json
[
  {
    "name": "João Fictício",
    "status": "queued"
  },
  {
    "name": "Maria Fictícia",
    "status": "in_progress"
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `6af7012ea7cb6fc8ff245a1e5816056a46e445bb`, início 2026-11-13T17:53:18.625Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (623 ms)
2. ok: Atendente entra e vê a fila vazia (109 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (181 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (145 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (222 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (320 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (147 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (294 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (178 ms): `06-painel-em-atendimento.png`
10. ok: Atendente assume outro chamado pelo painel (304 ms): `07-assumido-pelo-painel.png`
11. ok: Outro setor não vê a fila nem abre o chamado (1191 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (632 ms)

#### Estado final observado

Disputa simultânea: respostas HTTP e auditoria:

```json
{
  "respostas": [
    200,
    409
  ],
  "registrosDeAuditoria": 1
}
```

Outro setor pedindo o chamado pela API:

```json
{
  "http": 403
}
```

Chamado:

```json
{
  "protocol": "2026-000004",
  "status": "in_progress",
  "assignee": "Atendente1 398626778",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 398626778"
  }
]
```

Mensagens e chamados abertos do contato:

```json
{
  "mensagens": 2,
  "chamadosAbertos": 1
}
```
