# Verificação run-20261112-174746
Commit: 9c897b365b67eb0f0b444d7ce0dadd23dd097a52. Worktree: somente docs/decisoes-issue-145.md não rastreado, sem efeito na aplicação; demais arquivos correspondem ao commit.

- Commit: `9c897b365b67eb0f0b444d7ce0dadd23dd097a52` (branch `ticket/145-tela-conversas`)
- Arquivos sem commit na subida: 1
- Início: 2026-11-12 17:47:48 -0300
- Resumo gerado em: 2026-11-12 17:48:34 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | PASSOU | 12 | `evidence/close/` |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | PASSOU | 6 | `evidence/consult-subjects/` |
| conversas-menu | PASSOU | 4 | `evidence/conversas-menu/` |
| receive-and-assign | PASSOU | 12 | `evidence/receive-and-assign/` |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | PASSOU | 12 | `evidence/transfer/` |

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

- Linhas de erro no log do backend: 1, sendo 1 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261112-174746/logs/backend.log`

## Detalhe de cada jornada

## Jornada close: PASSOU

Commit `9c897b365b67eb0f0b444d7ce0dadd23dd097a52`, início 2026-11-12T20:48:13.755Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (497 ms)
2. ok: Atendente assume o chamado (428 ms)
3. ok: Formulário vazio não encerra e diz o que falta (436 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (868 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (595 ms)
6. ok: Fim antes do início é recusado (147 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (574 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (118 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (349 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (343 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (956 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (243 ms)

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
  "organization": "Prefeitura 493757718",
  "closed_by": "Atendente1 493756566",
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
    "actor": "Atendente1 493756566"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 493756566"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 493756566"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 6,
  "status": "queued"
}
```

## Jornada consult-subjects: PASSOU

Commit `9c897b365b67eb0f0b444d7ce0dadd23dd097a52`, início 2026-11-12T20:48:31.610Z, duração 3 s.

#### Passos

1. ok: Preparar setor, assuntos e dois chamados (503 ms)
2. ok: Assumir chamado e consultar soluções ao lado do chat (606 ms): `01-assuntos-e-chat.png`
3. ok: Enviar mensagem e buscar sem acentos ou maiúsculas (343 ms): `02-busca-por-solucao.png`
4. ok: Copiar a solução e manter o texto fora do chat (202 ms): `03-solucao-copiada.png`
5. ok: Outro chamado começa em Detalhes e o anterior mantém a busca (283 ms): `04-busca-restaurada.png`
6. ok: Estado final da conversa e da lista (228 ms)

#### Estado final observado

Mensagem enviada e assunto preservado:

```json
{
  "messages": [
    {
      "body": "Atendente1 511611098: Vou conferir as orientações."
    }
  ],
  "assuntos": 1
}
```

## Jornada conversas-menu: PASSOU

Commit `9c897b365b67eb0f0b444d7ce0dadd23dd097a52`, início 2026-11-12T20:48:04.071Z, duração 3 s.

#### Passos

1. ok: Preparar setor e atendente (452 ms)
2. ok: Abrir Conversas pelo menu (236 ms): `01-conversas-vazia.png`
3. ok: Abrir uma conversa e conferir os temas (1682 ms): `02-fila-com-chamado.png`, `03-conversa-claro.png`, `04-conversa-escuro.png`, `05-conversa-alto-contraste.png`
4. ok: Estado final do setor (122 ms)

#### Estado final observado

Chamados em atendimento no setor:

```json
{
  "quantidade": 1
}
```

## Jornada receive-and-assign: PASSOU

Commit `9c897b365b67eb0f0b444d7ce0dadd23dd097a52`, início 2026-11-12T20:48:07.813Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (582 ms)
2. ok: Atendente entra e vê a fila vazia (119 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (179 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (138 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (241 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (342 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (199 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (283 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (195 ms): `06-painel-em-atendimento.png`
10. ok: Atendente assume outro chamado pelo painel (335 ms): `07-assumido-pelo-painel.png`
11. ok: Outro setor não vê a fila nem abre o chamado (1010 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (610 ms)

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
  "assignee": "Atendente1 487814119",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 487814119"
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

## Jornada transfer: PASSOU

Commit `9c897b365b67eb0f0b444d7ce0dadd23dd097a52`, início 2026-11-12T20:48:20.980Z, duração 10 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1104 ms)
2. ok: Atendente assume o chamado (465 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (277 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (849 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (295 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (16 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (1048 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (251 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (568 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1952 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (727 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (246 ms)

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
  "assignee": "Atendente1 500981412",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 500981412",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 12,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 500981412",
    "changes": {
      "assignee_id": {
        "to": 13,
        "from": 12
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 500981412",
    "changes": {
      "assignee_id": {
        "to": 12,
        "from": 13
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 500981412",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 500982505",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 9,
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

## Comparação com o protótipo aprovado

As capturas de Conversas nos temas claro, escuro e alto contraste foram conferidas. A estrutura e a hierarquia da fila e do botão Assumir correspondem ao protótipo; as capturas usam 1280 px e dados fictícios. O aviso de contato não cadastrado depende dos dados de teste. O título pode quebrar para preservar nomes longos.

## Log e limpeza

Uma requisição de chamados encerrados foi cancelada pelo cliente: `list closed tickets: context canceled` em `/api/sectors/5/closed-today`; nenhuma outra linha de erro do backend foi registrada. A limpeza confirmou que processos e contêineres próprios foram encerrados e as quatro portas ficaram livres.
