# Jornada close: PASSOU

Commit `1f319abd65aee3c5bcca663fdb833cbb047b9c90`, início 2026-11-26T02:52:08.375Z, duração 8 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (500 ms)
2. ok: Atendente assume o chamado (279 ms)
3. ok: Formulário vazio não encerra e diz o que falta (367 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (858 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (557 ms)
6. ok: Fim antes do início é recusado (159 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (720 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (83 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (372 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (323 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelar pelo X da fila, com a confirmação no item e sem motivo, dispensa o cadastro (885 ms): `08-cancelamento-confirmar.png`, `09-cancelado-no-historico.png`, `10-cancelado-sem-motivo.png`
12. ok: A janela de cancelamento salva com o motivo opcional (1024 ms): `11-cancelamento-motivo-opcional.png`
13. ok: Estado final do encerramento no banco (227 ms)

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
  "organization": "Prefeitura 528377578",
  "closed_by": "Atendente1 528376812",
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
    "actor": "Atendente1 528376812"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 528376812"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 528376812"
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
