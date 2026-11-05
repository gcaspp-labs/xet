# Jornada revisao-t87: PASSOU

Commit `1a4bdbbeb3114e717a645800f6ecbb0c7de0f2e4`, início 2026-11-05T16:21:44.285Z, duração 14 s.

### Passos

1. ok: Preparar dois setores conectados com usuários próprios (618 ms)
2. ok: Administrador com preferências antigas salvas não vê alerta da fila existente (943 ms): `01-admin-sino-vazio-com-fila.png`
3. ok: Menu do administrador sem Alertas; tema, acessibilidade, Usuários e Sair presentes (423 ms): `02-admin-menu-sem-alertas.png`
4. ok: Supervisor mantém preferências, lista e contador do próprio setor (1261 ms): `03-supervisor-sino.png`
5. ok: Atendente mantém preferências, lista e contador do próprio setor (1086 ms): `04-atendente-sino.png`
6. ok: Chamado novo alerta supervisor e atendente; administrador recebe só a fila no painel (2600 ms): `05-admin-nova-fila-sem-alertas.png`
7. ok: Administrador troca o setor no painel e assume o chamado pela fila (1012 ms): `06-admin-assumiu-pelo-painel.png`
8. ok: Número desconectado conta sozinho no sino e título do administrador (462 ms): `07-admin-so-numero-desconectado.png`
9. ok: Preparar novo pareamento: celular desvincula a conta, exigindo QR code (218 ms)
10. ok: Reconectar o número limpa contador e título apesar das filas restantes (304 ms): `08-admin-reconectou.png`
11. ok: Estado final no banco: filas preservadas, administrador responsável e auditoria única (607 ms)

### Estado final observado

Chamado novo: efeitos observados:

```json
{
  "administrador": {
    "notifications": [],
    "beeps": 0
  },
  "supervisor": {
    "notifications": [
      {
        "title": "Chamado recebido",
        "body": "Nova Revisão"
      }
    ],
    "beeps": 1
  },
  "atendente": {
    "notifications": [
      {
        "title": "Chamado recebido",
        "body": "Nova Revisão"
      }
    ],
    "beeps": 1
  }
}
```

Chamados:

```json
[
  {
    "name": "Antiga Revisão",
    "status": "queued",
    "assignee_id": null
  },
  {
    "name": "Nova Revisão",
    "status": "in_progress",
    "assignee_id": 1
  },
  {
    "name": "Outro Setor Revisão",
    "status": "queued",
    "assignee_id": null
  }
]
```

Auditoria da atribuição:

```json
[
  {
    "action": "ticket_assigned",
    "actor_id": 1
  }
]
```
