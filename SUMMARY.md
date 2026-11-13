# Verificação run-20261112-223704

Commit: 8e64d5223da91ef529c51ea88e4f19df9c948751. Worktree: limpa. Level: journeys.

A primeira tentativa de correção falhou porque o roteiro selecionou um elemento oculto; a jornada corrigida selecionou o rádio visível e passou. As duas tentativas estão preservadas. As capturas foram inspecionadas. Não houve comparação visual completa com as capturas do protótipo; o WhatsApp real não foi testado.

- Commit: `8e64d5223da91ef529c51ea88e4f19df9c948751` (branch `ticket/150-assuntos-por-modulo`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-12 22:37:06 -0300
- Resumo gerado em: 2026-11-12 22:39:19 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | PASSOU | 12 | `evidence/close/` |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | PASSOU | 6 | `evidence/consult-subjects/` |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | PASSOU | 12 | `evidence/transfer/` |
| assuntos-provisoria (fora do mapa) | PASSOU | 3 | `evidence/assuntos-provisoria/` |
| correcao-provisoria (fora do mapa) | FALHOU | 2 | `evidence/correcao-provisoria/` |
| correcao-revisada (fora do mapa) | PASSOU | 3 | `evidence/correcao-revisada/` |

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

## Sinais do backend

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261112-223704/logs/backend.log`

## Detalhe de cada jornada

## Jornada assuntos-provisoria: PASSOU

Commit `8e64d5223da91ef529c51ea88e4f19df9c948751`, início 2026-11-13T01:37:54.704Z, duração 3 s.

#### Passos

1. ok: Cadastrar assunto em um módulo (729 ms): `01-assunto-cadastrado.png`
2. ok: Trocar módulo e filtrar lista (1343 ms): `02-assunto-filtrado.png`
3. ok: Conferir módulo salvo (116 ms)

#### Estado final observado

Assunto e módulo:

```json
[
  {
    "name": "Senha de acesso",
    "module": "Patrimônio"
  }
]
```

## Jornada close: PASSOU

Commit `8e64d5223da91ef529c51ea88e4f19df9c948751`, início 2026-11-13T01:37:47.565Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (497 ms)
2. ok: Atendente assume o chamado (480 ms)
3. ok: Formulário vazio não encerra e diz o que falta (430 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (972 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (531 ms)
6. ok: Fim antes do início é recusado (137 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (529 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (90 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (339 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (294 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (818 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (248 ms)

#### Estado final observado

Chamado cancelado:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "action": "ticket_cancelled",
  "reason": "Golpe do falso boleto.",
  "contact_registered": false
}
```

Chamado encerrado:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Contracheque",
  "resolution": "Enviada a segunda via.",
  "organization": "Prefeitura 867567778",
  "closed_by": "Atendente1 867566333",
  "has_closed_at": true,
  "end_after_start": true,
  "modules": "Folha, Patrimônio"
}
```

Auditoria do encerramento:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 867566333"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 867566333"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 867566333"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 7,
  "status": "queued"
}
```

## Jornada consult-subjects: PASSOU

Commit `8e64d5223da91ef529c51ea88e4f19df9c948751`, início 2026-11-13T01:37:33.693Z, duração 3 s.

#### Passos

1. ok: Preparar setor, assuntos e dois chamados (533 ms)
2. ok: Assumir chamado e consultar soluções ao lado do chat (686 ms): `01-assuntos-e-chat.png`
3. ok: Enviar mensagem e buscar sem acentos ou maiúsculas (324 ms): `02-busca-por-solucao.png`
4. ok: Copiar a solução e manter o texto fora do chat (192 ms): `03-solucao-copiada.png`
5. ok: Outro chamado começa em Detalhes e o anterior mantém a busca (341 ms): `04-busca-restaurada.png`
6. ok: Estado final da conversa e da lista (223 ms)

#### Estado final observado

Mensagem enviada e assunto preservado:

```json
{
  "messages": [
    {
      "body": "Atendente1 853694738: Vou conferir as orientações."
    }
  ],
  "assuntos": 1
}
```

## Jornada correcao-provisoria: FALHOU

Commit `8e64d5223da91ef529c51ea88e4f19df9c948751`, início 2026-11-13T01:38:29.590Z, duração 26 s.

#### Passos

1. ok: Assumir e encerrar um chamado (1877 ms)
2. FALHOU: Corrigir assunto e escolher módulo para a lista (20530 ms): `01-escolha-modulo-correcao.png`

#### Falha

```text
locator.click: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: 'Corrigir atendimento' }).getByText('Patrimônio', { exact: true }).last()
    - locator resolved to <label id="base-ui-_r_18_-label" class="flex items-center gap-2">…</label>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    39 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms

    at .verify-app/runs/run-20261112-223704/evidence/correcao-provisoria.mjs:41:65
    at async Journey.step (scripts/verify/scripts/journey-lib.mjs:83:21)
    at async file://.verify-app/runs/run-20261112-223704/evidence/correcao-provisoria.mjs:32:3
    at async journey (scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file://.verify-app/runs/run-20261112-223704/evidence/correcao-provisoria.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        6192        3427         675        6856        9229
Swap:           2047         299        1748

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 306220 3509448 411232 6609812    0   11   380  1520 9077    8 14  3 83  1  0  0
 2  0 306220 3506972 411232 6612092    0    0     0     0 6631 6579 10  1 88  0  0  0
 2  0 306220 3513024 411232 6611968    0    0     0     0 8739 10971 12  2 86  0  0  0
```

## Jornada correcao-revisada: PASSOU

Commit `8e64d5223da91ef529c51ea88e4f19df9c948751`, início 2026-11-13T01:39:11.993Z, duração 4 s.

#### Passos

1. ok: Assumir e encerrar um chamado (1840 ms)
2. ok: Corrigir assunto e escolher módulo para a lista (890 ms): `01-escolha-modulo-correcao.png`, `02-correcao-salva.png`
3. ok: Conferir chamado, módulo e assunto no banco (118 ms)

#### Estado final observado

Correção e assunto cadastrado:

```json
[
  {
    "subject": "Assunto corrigido",
    "listed_subject": "Assunto corrigido",
    "module": "Patrimônio"
  }
]
```

## Jornada transfer: PASSOU

Commit `8e64d5223da91ef529c51ea88e4f19df9c948751`, início 2026-11-13T01:37:37.167Z, duração 10 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1170 ms)
2. ok: Atendente assume o chamado (454 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (306 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (849 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (291 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (20 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (1004 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (236 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (583 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1746 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (739 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (252 ms)

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
  "assignee": "Atendente1 857167376",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 857167376",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 5,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 857167376",
    "changes": {
      "assignee_id": {
        "to": 6,
        "from": 5
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 857167376",
    "changes": {
      "assignee_id": {
        "to": 5,
        "from": 6
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 857167376",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 857168051",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 4,
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
