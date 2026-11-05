# Verificação run-20261105-074846

- Commit: `27f483034078a4d4419e2a251efa3ac176466587` (branch `task/49-paineis-por-janelas-centrais`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-05 07:48:48 -0300
- Resumo gerado em: 2026-11-05 07:52:35 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | FALHOU | 1 | `evidence/close/` |
| connection | PASSOU | 10 | `evidence/connection/` |
| receive-and-assign | PASSOU | 11 | `evidence/receive-and-assign/` |
| reply | PASSOU | 13 | `evidence/reply/` |
| transfer | PASSOU | 12 | `evidence/transfer/` |
| pr71-recheck-verified (fora do mapa) | PASSOU | 7 | `evidence/pr71-recheck-verified/` |

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

## Sinais do backend

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261105-074846/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 45 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261105-074846/evidence.

## Detalhe de cada jornada

## Jornada close: FALHOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:50:49.043Z, duração 52 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (338 ms)

#### Falha

```text
locator.click: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Entrar' })
    - locator resolved to <button tabindex="0" type="submit" data-slot="button" class="group/button inline-flex shrink-0 cursor-pointer items-center justify-center border font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px] border-primary bg-primary text-primary-foreground hover:border-accent-strong hover:bg-accent-strong gap-[7px] rounded-(--radius-8) px-3.5 py-2 text-[calc(13px*var(--…>Entrar</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action

    at Journey.signIn (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:137:56)
    at async file:///home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/journeys/close.mjs:18:26
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/journeys/close.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        4267        6373         772        5886       11154
Swap:           2047           0        2047

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 1  1      0 6526176 253844 5774364    0    0  6767  1206 7777    6  4  2 92  2  0  0
 2  1      0 6526288 253844 5774088    0    0     0     0 8284 16625  4  2 87  7  0  0
 1  1      0 6527176 253844 5773928    0    0     0     0 6610 11434  2  2 90  7  0  0
```

## Jornada connection: PASSOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:51:40.899Z, duração 4 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (251 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (308 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (222 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (229 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (279 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (310 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (803 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (417 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (622 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (133 ms)

#### Estado final observado

Atendente tentando conectar pela API:

```json
{
  "http": 403
}
```

Setor:

```json
{
  "connection_status": "logged_out",
  "phone": null,
  "external_account_id": null
}
```

Auditoria da conexão:

```json
[
  {
    "action": "sector_connected",
    "actor": null
  },
  {
    "action": "sector_disconnected",
    "actor": null
  },
  {
    "action": "sector_connected",
    "actor": null
  },
  {
    "action": "sector_disconnected",
    "actor": "Supervisor 900900364"
  }
]
```

## Jornada pr71-recheck-verified: PASSOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:51:59.321Z, duração 6 s.

#### Passos

1. ok: Preparar setor e contato fictícios (301 ms)
2. ok: Assumir e abrir encerramento com bloqueio (412 ms)
3. ok: Esc preserva o assunto, e Cancelar no cadastro volta à janela de origem (202 ms)
4. ok: Completar registro e salvar contato pela janela aninhada (681 ms)
5. ok: Aviso visível sobre Encerrar deixa o clique passar, sem força ou espera (3148 ms): `01-contato-salvo-sobre-encerrar.png`, `02-encerrado-sem-bloqueio.png`
6. ok: Assumir pelo sino mantém Abrir conversa clicável (889 ms): `03-link-abrir-conversa-funciona.png`
7. ok: Estado final confirmado no banco (128 ms)

#### Estado final observado

Clique sob o aviso:

```json
{
  "forcado": false,
  "esperaAntesDoClique": false,
  "intersecaoComBotao": {
    "x": 25.5,
    "y": 29.622589111328125
  }
}
```

Chamado encerrado:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Contracheque de teste",
  "resolution": "Segunda via enviada no teste fictício."
}
```

Chamado aberto pelo link:

```json
{
  "status": "in_progress",
  "assignee_id": 21
}
```

## Jornada receive-and-assign: PASSOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:51:45.381Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (385 ms)
2. ok: Atendente entra e vê a fila vazia (85 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (164 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (78 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (149 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (183 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (143 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (157 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (140 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (760 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (311 ms)

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
  "protocol": "2026-000002",
  "status": "in_progress",
  "assignee": "Atendente1 905381485",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 905381485"
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

## Jornada reply: PASSOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:51:49.207Z, duração 3 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (270 ms)
2. ok: Sem assumir, não há como responder (168 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (92 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (214 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (169 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (53 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (143 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (134 ms)
9. ok: Pela API, quem não é responsável também é recusado (143 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (289 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (199 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (171 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (62 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 6,
  "linhas": 1
}
```

Resposta indevida pela API:

```json
{
  "http": 403,
  "mensagensAlteradas": 0
}
```

Mensagens do chamado:

```json
[
  {
    "direction": "inbound",
    "origin": "customer",
    "type": "text",
    "status": null,
    "body": "Preciso do contracheque",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "read",
    "body": "Segue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "Contracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "Mensagem com o número caído",
    "accepted_by_provider": true
  }
]
```

## Jornada transfer: PASSOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:51:52.638Z, duração 6 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (715 ms)
2. ok: Atendente assume o chamado (226 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (183 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (681 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (232 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (7 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (562 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (135 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (277 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1105 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (383 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (120 ms)

#### Estado final observado

Resposta do responsável anterior pela API:

```json
{
  "http": 403
}
```

Chamado transferido:

```json
{
  "status": "in_progress",
  "assignee": "Atendente1 912639678",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 912639678",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 16,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 912639678",
    "changes": {
      "assignee_id": {
        "to": 17,
        "from": 16
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 912639678",
    "changes": {
      "assignee_id": {
        "to": 16,
        "from": 17
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 912639678",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 912640957",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 6,
    "subject": null
  }
]
```

Auditoria da origem:

```json
[
  {
    "action": "ticket_assigned"
  },
  {
    "action": "ticket_organization_linked"
  },
  {
    "action": "ticket_transferred_sector"
  }
]
```
