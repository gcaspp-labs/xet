# Jornada revisao-t88: PASSOU

Commit `d974df6ae5d5b4fce362b93ed23560e0abbaa762`, início 2026-11-05T16:59:45.037Z, duração 12 s.

### Passos

1. ok: Preparar setor conectado e atendente (464 ms)
2. ok: Cadastro sugere primeiro e último nome e para de acompanhar após edição manual (1109 ms): `01-sugestao-editada.png`
3. ok: Editar nome mantém apelido; vazio volta ao primeiro e último nome (1279 ms): `02-apelido-padrao-persistido.png`
4. ok: Apelido repetido ignora maiúsculas e mostra erro no formulário (1017 ms): `03-apelido-duplicado.png`
5. ok: Assumir e enviar texto com o apelido na conversa (650 ms): `04-texto-com-apelido.png`
6. ok: Repetição não duplica prefixo nem linha; texto vazio é recusado (276 ms)
7. ok: Imagem com legenda e documento sem legenda mostram o prefixo (596 ms): `05-imagem-com-legenda.png`, `06-documento-sem-legenda.png`
8. ok: Reenvio após trocar apelido preserva prefixo antigo; próxima mensagem usa o novo (1053 ms): `07-apelidos-antigo-e-novo.png`
9. ok: Áudio gravado com microfone simulado sai sem prefixo (2272 ms): `08-audio-sem-prefixo.png`
10. ok: Nova conversa envia primeira mensagem com apelido atual (848 ms): `09-primeira-mensagem.png`
11. ok: Estado final: textos, anexos, áudio, cadastro e auditoria no banco (365 ms)

### Estado final observado

Mensagens:

```json
[
  {
    "origin": "customer",
    "type": "text",
    "body": "Mensagem sem prefixo",
    "status": null
  },
  {
    "origin": "agent",
    "type": "text",
    "body": "Atendente Revisão 1793897986669: Bom dia",
    "status": "sent"
  },
  {
    "origin": "agent",
    "type": "image",
    "body": "Atendente Revisão 1793897986669: Comprovante fictício",
    "status": "sent"
  },
  {
    "origin": "agent",
    "type": "document",
    "body": "Atendente Revisão 1793897986669:",
    "status": "sent"
  },
  {
    "origin": "agent",
    "type": "text",
    "body": "Atendente Revisão 1793897986669: Falha controlada",
    "status": "sent"
  },
  {
    "origin": "agent",
    "type": "text",
    "body": "Novo Apelido 1793897986669: Depois da troca",
    "status": "sent"
  },
  {
    "origin": "agent",
    "type": "audio",
    "body": null,
    "status": "sent"
  }
]
```

Primeira mensagem:

```json
[
  {
    "body": "Novo Apelido 1793897986669: Primeiro contato"
  }
]
```

Auditoria do apelido:

```json
[
  {
    "action": "user_created",
    "changes": {
      "name": {
        "to": "Atendente1 985038350",
        "from": null
      },
      "role": {
        "to": "agent",
        "from": null
      },
      "email": {
        "to": "atendente1.985038350@verify.test",
        "from": null
      },
      "nickname": {
        "to": "Atendente1 985038350",
        "from": null
      },
      "sector_id": {
        "to": 1,
        "from": null
      }
    }
  },
  {
    "action": "user_updated",
    "changes": {
      "nickname": {
        "to": "Atendente Revisão 1793897986669",
        "from": "Atendente1 985038350"
      }
    }
  },
  {
    "action": "user_updated",
    "changes": {
      "nickname": {
        "to": "Novo Apelido 1793897986669",
        "from": "Atendente Revisão 1793897986669"
      }
    }
  }
]
```
