# Jornada close: PASSOU

Commit `c1625fbff876021bc22bb903c60586ceddea42a9`, início 2026-11-25T00:45:07.971Z, duração 6 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (334 ms)
2. ok: Atendente assume o chamado (170 ms)
3. ok: Formulário vazio não encerra e diz o que falta (263 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (632 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (458 ms)
6. ok: Fim antes do início é recusado (80 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (514 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (58 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (309 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (236 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelar pelo X da fila, com a confirmação no item e sem motivo, dispensa o cadastro (678 ms): `08-cancelamento-confirmar.png`, `09-cancelado-no-historico.png`, `10-cancelado-sem-motivo.png`
12. ok: A janela de cancelamento salva com o motivo opcional (872 ms): `11-cancelamento-motivo-opcional.png`
13. ok: Estado final do encerramento no banco (179 ms)

### Estado final observado

Chamado cancelado pelo X, sem motivo:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "action": "ticket_cancelled",
  "reason": null,
  "contact_registered": false
}
```

Chamado cancelado pela janela, sem motivo:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "action": "ticket_cancelled",
  "reason": null
}
```

Chamado encerrado:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Contracheque",
  "resolution": "Enviada a segunda via.",
  "organization": "Prefeitura 507972015",
  "closed_by": "Atendente1 507971374",
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
    "actor": "Atendente1 507971374"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 507971374"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 507971374"
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
