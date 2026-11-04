# Jornada close: PASSOU

Commit `78e14f19b378de4aece1d2ddba34ec00ea5abab1`, início 2026-11-04T00:08:23.453Z, duração 7 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (532 ms)
2. ok: Atendente assume o chamado (274 ms)
3. ok: Formulário vazio não encerra e diz o que falta (417 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (979 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (503 ms)
6. ok: Fim antes do início é recusado (127 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (480 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (91 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (294 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (340 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (1089 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (239 ms)

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
  "organization": "Prefeitura 903455037",
  "closed_by": "Atendente1 903454392",
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
    "actor": "Atendente1 903454392"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 903454392"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 903454392"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 4,
  "status": "queued"
}
```
