# Jornada close: PASSOU

Commit `8f8b5ee8fcdd10cbbffa936e87ef555db454ff27`, início 2026-11-26T07:47:17.003Z, duração 8 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (429 ms)
2. ok: Atendente assume o chamado (221 ms)
3. ok: Formulário vazio não encerra e diz o que falta (323 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (848 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (503 ms)
6. ok: Fim antes do início é recusado (118 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (636 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (111 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (379 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (305 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelar pelo X da fila, com a confirmação no item e sem motivo, dispensa o cadastro (883 ms): `08-cancelamento-confirmar.png`, `09-cancelado-no-historico.png`, `10-cancelado-sem-motivo.png`
12. ok: A janela de cancelamento salva com o motivo opcional (1049 ms): `11-cancelamento-motivo-opcional.png`
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
  "organization": "Prefeitura 237005512",
  "closed_by": "Atendente1 237004738",
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
    "actor": "Atendente1 237004738"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 237004738"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 237004738"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 8,
  "status": "queued"
}
```
