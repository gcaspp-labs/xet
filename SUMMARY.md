# Verificação run-20261104-125658

- Commit: `fc61612a99a438ce614bf4d91145f3b98ff2a21e` (branch `task/41-publicacao-cloudflare-tunnel-access`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-04 12:57:00 -0300
- Resumo gerado em: 2026-11-04 13:01:39 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | PASSOU | 12 | `evidence/close/` |
| connection | PASSOU | 10 | `evidence/connection/` |
| receive-and-assign | PASSOU | 11 | `evidence/receive-and-assign/` |
| reply | PASSOU | 13 | `evidence/reply/` |
| transfer | PASSOU | 12 | `evidence/transfer/` |
| t41-login-proxy (fora do mapa) | PASSOU | 8 | `evidence/t41-login-proxy/` |

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

- Linhas de erro no log do backend: 2, sendo 2 de requisição cancelada pelo cliente.
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-125658/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 56 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-125658/evidence.

## Detalhe de cada jornada

## Jornada close: PASSOU

Commit `fc61612a99a438ce614bf4d91145f3b98ff2a21e`, início 2026-11-04T15:58:04.024Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (754 ms)
2. ok: Atendente assume o chamado (327 ms)
3. ok: Formulário vazio não encerra e diz o que falta (424 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (992 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (548 ms)
6. ok: Fim antes do início é recusado (151 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (502 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (93 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (308 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (448 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (1065 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (406 ms)

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
  "organization": "Prefeitura 884026034",
  "closed_by": "Atendente1 884025623",
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
    "actor": "Atendente1 884025623"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 884025623"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 884025623"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 2,
  "status": "queued"
}
```

## Jornada connection: PASSOU

Commit `fc61612a99a438ce614bf4d91145f3b98ff2a21e`, início 2026-11-04T15:58:11.665Z, duração 7 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (593 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (368 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (287 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (375 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (356 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (373 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1286 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (832 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (839 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (440 ms)

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
    "actor": "Supervisor 891665273"
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `fc61612a99a438ce614bf4d91145f3b98ff2a21e`, início 2026-11-04T15:58:18.502Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (896 ms)
2. ok: Atendente entra e vê a fila vazia (108 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (227 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (241 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (348 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (273 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (196 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (476 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (165 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1114 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (1117 ms)

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
  "assignee": "Atendente1 898502731",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 898502731"
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

Commit `fc61612a99a438ce614bf4d91145f3b98ff2a21e`, início 2026-11-04T15:58:25.433Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (631 ms)
2. ok: Sem assumir, não há como responder (286 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (141 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (282 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (250 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (63 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (189 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (418 ms)
9. ok: Pela API, quem não é responsável também é recusado (459 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (297 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (310 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (328 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (211 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 8,
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

## Jornada t41-login-proxy: PASSOU

Commit `fc61612a99a438ce614bf4d91145f3b98ff2a21e`, início 2026-11-04T16:00:30.362Z, duração 4 s.

#### Passos

1. ok: Compose isolado: quatro serviços sem porta publicada e WhatsApp falso (7 ms)
2. ok: Login errado pela tela: 203.0.113.10 (tentativa 1) (584 ms): `01-login-1-recusado.png`
3. ok: Login errado pela tela: 203.0.113.10 (tentativa 2) (428 ms): `02-login-2-recusado.png`
4. ok: Login errado pela tela: 198.51.100.20 (tentativa 3) (472 ms): `03-login-3-recusado.png`
5. ok: Login errado pela tela: 192.0.2.30 (tentativa 4) (480 ms): `04-login-4-recusado.png`
6. ok: Login errado pela tela: 2001:db8::7 (tentativa 5) (478 ms): `05-login-5-recusado.png`
7. ok: Login errado pela tela: sem CF-Connecting-IP (tentativa 6) (464 ms): `06-login-6-recusado.png`
8. ok: Estado final no banco do Compose: IPs separados, IPv6, XFF ignorado e fallback do Caddy (415 ms)

#### Estado final observado

Serviços e portas no host:

```json
[
  {
    "service": "cloudflared",
    "ports": {}
  },
  {
    "service": "web",
    "ports": {}
  },
  {
    "service": "backend",
    "ports": {}
  },
  {
    "service": "postgres",
    "ports": {}
  }
]
```

Token ausente e vazio:

```json
"Os dois comandos Compose equivalentes ao make up falharam antes de criar contêineres; logs compose-absent.log e compose-empty.log. Sem alteração de deploy/.env."
```

login_attempts (IPs):

```json
[
  {
    "scope": "ip",
    "subject": "172.20.0.4",
    "failures": 1
  },
  {
    "scope": "ip",
    "subject": "192.0.2.30",
    "failures": 1
  },
  {
    "scope": "ip",
    "subject": "198.51.100.20",
    "failures": 1
  },
  {
    "scope": "ip",
    "subject": "2001:db8::7",
    "failures": 1
  },
  {
    "scope": "ip",
    "subject": "203.0.113.10",
    "failures": 2
  }
]
```

Sessões criadas pelos logins inválidos:

```json
0
```

Limite desta prova:

```json
"Navegador chega ao Caddy pela rede Docker local; cabeçalhos simulam o cloudflared. Token falso. Túnel, HTTPS e Access reais dependem da T34. Sem CF-Connecting-IP, o contador usa o IP do Caddy."
```

## Jornada transfer: PASSOU

Commit `fc61612a99a438ce614bf4d91145f3b98ff2a21e`, início 2026-11-04T15:58:30.954Z, duração 10 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1441 ms)
2. ok: Atendente assume o chamado (303 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (259 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (973 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (241 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (17 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (1066 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (444 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (453 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1544 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (501 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (457 ms)

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
  "assignee": "Atendente1 910955347",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 910955347",
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
    "actor": "Atendente1 910955347",
    "changes": {
      "assignee_id": {
        "to": 17,
        "from": 16
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 910955347",
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
    "sector": "Setor 910955347",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 910956091",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 8,
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
