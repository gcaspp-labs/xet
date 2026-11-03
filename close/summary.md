# Jornada close: PASSOU

Commit `0a03a2d659c2c5cb93717d0598640c9d530ec6d2`, início 2026-11-03T21:03:39.873Z, duração 7 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (516 ms)
2. ok: Atendente assume o chamado (289 ms)
3. ok: Formulário vazio não encerra e diz o que falta (393 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (794 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (483 ms)
6. ok: Fim antes do início é recusado (136 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (447 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (99 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (326 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (326 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (989 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (249 ms)

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
  "organization": "Prefeitura 819875708",
  "closed_by": "Atendente1 819874727",
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
    "actor": "Atendente1 819874727"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 819874727"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 819874727"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 28,
  "status": "queued"
}
```
