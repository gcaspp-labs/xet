# Jornada close: PASSOU

Commit `c3f901a16d00d60071426b57631babe9242823d1`, início 2026-11-23T18:10:50.771Z, duração 7 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (515 ms)
2. ok: Atendente assume o chamado (268 ms)
3. ok: Formulário vazio não encerra e diz o que falta (332 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (798 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (611 ms)
6. ok: Fim antes do início é recusado (94 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (584 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (94 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (316 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (275 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (1377 ms): `08-cancelamento.png`, `09-cancelado-no-historico.png`
12. ok: Estado final do encerramento no banco (238 ms)

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
  "organization": "Prefeitura 450773228",
  "closed_by": "Atendente1 450772365",
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
    "actor": "Atendente1 450772365"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 450772365"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 450772365"
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
