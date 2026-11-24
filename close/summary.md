# Jornada close: PASSOU

Commit `bcf3854efb1597d168d638dc047d182407a75c9e`, início 2026-11-24T17:02:36.821Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (360 ms)
2. ok: Atendente assume o chamado (175 ms)
3. ok: Formulário vazio não encerra e diz o que falta (244 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (597 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (393 ms)
6. ok: Fim antes do início é recusado (94 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (454 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (70 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (259 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (219 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (988 ms): `08-cancelamento.png`, `09-cancelado-no-historico.png`
12. ok: Estado final do encerramento no banco (124 ms)

### Estado final observado

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
  "organization": "Prefeitura 756823316",
  "closed_by": "Atendente1 756822595",
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
    "actor": "Atendente1 756822595"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 756822595"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 756822595"
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
