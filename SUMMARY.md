# Verificação run-20261105-143512

- Commit: `f34f7a1d10c434a993bea12625a7d65db1fe7b9c` (branch `task/89-email-do-setor`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-05 14:35:14 -0300
- Resumo gerado em: 2026-11-05 14:37:24 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | PASSOU | 10 | `evidence/connection/` |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| revisao-t89 (fora do mapa) | PASSOU | 12 | `evidence/revisao-t89/` |

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
- Log: `.verify-app/runs/run-20261105-143512/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 27 arquivo(s) em .verify-app/runs/run-20261105-143512/evidence.

## Detalhe de cada jornada

## Jornada connection: PASSOU

Commit `f34f7a1d10c434a993bea12625a7d65db1fe7b9c`, início 2026-11-05T17:36:50.262Z, duração 6 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (413 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (502 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (260 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (341 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (384 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (401 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (924 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (650 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (742 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (284 ms)

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
    "actor": "Supervisor 210263932"
  }
]
```

## Jornada revisao-t89: PASSOU

Commit `f34f7a1d10c434a993bea12625a7d65db1fe7b9c`, início 2026-11-05T17:36:41.093Z, duração 9 s.

#### Passos

1. ok: Entrar pela tela e abrir Setores pelo menu (117 ms)
2. ok: Formato inválido fica no formulário; campo opcional após Nome (428 ms): `01-formato-invalido.png`
3. ok: Cadastrar com e-mail e conferir coluna, inclusive espaços removidos (562 ms): `02-cadastro-com-email.png`
4. ok: Dois setores sem e-mail convivem e exibem travessão (1011 ms)
5. ok: Cadastro recusa repetido com outras maiúsculas e HTTP 409 (406 ms): `03-repetido-cadastro.png`
6. ok: Edição recusa repetido e formato inválido (645 ms): `04-repetido-edicao.png`
7. ok: Preencher, trocar, salvar sem mudança e limpar na tela (2103 ms)
8. ok: Tema light, largura 1280, texto Maior: tabela, rolagem e edição (575 ms): `05-light-1280-tabela.png`, `06-light-1280-formulario.png`
9. ok: Tema light, largura 390, texto Maior: tabela, rolagem e edição (577 ms): `07-light-390-tabela.png`, `08-light-390-acoes-apos-rolagem.png`, `09-light-390-formulario.png`
10. ok: Tema dark, largura 1280, texto Maior: tabela, rolagem e edição (646 ms): `10-dark-1280-tabela.png`, `11-dark-1280-formulario.png`
11. ok: Tema dark, largura 390, texto Maior: tabela, rolagem e edição (594 ms): `12-dark-390-tabela.png`, `13-dark-390-acoes-apos-rolagem.png`, `14-dark-390-formulario.png`
12. ok: Banco final confirma email, nulos e auditoria de preencher/trocar/limpar (359 ms)

#### Estado final observado

Tabela light 1280:

```json
{
  "clientWidth": 960,
  "scrollWidth": 960,
  "overflow": "auto",
  "pageWidth": 1280,
  "viewport": 1280
}
```

Tabela light 390:

```json
{
  "clientWidth": 356,
  "scrollWidth": 811,
  "overflow": "auto",
  "pageWidth": 390,
  "viewport": 390
}
```

Tabela dark 1280:

```json
{
  "clientWidth": 960,
  "scrollWidth": 960,
  "overflow": "auto",
  "pageWidth": 1280,
  "viewport": 1280
}
```

Tabela dark 390:

```json
{
  "clientWidth": 356,
  "scrollWidth": 811,
  "overflow": "auto",
  "pageWidth": 390,
  "viewport": 390
}
```

Setores no banco:

```json
[
  {
    "id": 1,
    "name": "Financeiro Teste",
    "email": "financeiro@prefeitura-exemplo.test"
  },
  {
    "id": 2,
    "name": "Recursos Humanos Teste",
    "email": null
  },
  {
    "id": 3,
    "name": "Sem Email Teste",
    "email": null
  }
]
```

Auditoria preenchimento/troca/limpeza:

```json
[
  {
    "action": "sector_created",
    "changes": {
      "name": {
        "to": "Recursos Humanos Teste",
        "from": null
      },
      "provider": {
        "to": "whatsmeow",
        "from": null
      }
    }
  },
  {
    "action": "sector_updated",
    "changes": {
      "email": {
        "to": "rh@prefeitura-exemplo.test",
        "from": null
      }
    }
  },
  {
    "action": "sector_updated",
    "changes": {
      "email": {
        "to": "pessoas@prefeitura-exemplo.test",
        "from": "rh@prefeitura-exemplo.test"
      }
    }
  },
  {
    "action": "sector_updated",
    "changes": {
      "email": {
        "to": null,
        "from": "pessoas@prefeitura-exemplo.test"
      }
    }
  }
]
```

Auditoria cadastro com e-mail:

```json
[
  {
    "changes": {
      "name": {
        "to": "Financeiro Teste",
        "from": null
      },
      "email": {
        "to": "financeiro@prefeitura-exemplo.test",
        "from": null
      },
      "provider": {
        "to": "whatsmeow",
        "from": null
      }
    }
  }
]
```
