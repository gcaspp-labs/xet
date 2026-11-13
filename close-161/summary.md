# Jornada close-161: PASSOU

Commit `73d1edf61a12b80c5c2e36a620379e77b4b5ff02`, início 2026-11-13T16:20:52.768Z, duração 7 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (559 ms)
2. ok: Atendente assume o chamado (363 ms)
3. ok: Formulário vazio não encerra e diz o que falta (367 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (898 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (511 ms)
6. ok: Fim antes do início é recusado (143 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (782 ms): `03-formulario-completo.png`, `04-retorno-conversas.png`, `05-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (107 ms): `06-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (240 ms): `07-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (316 ms): `08-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (1109 ms): `09-cancelamento.png`, `10-retorno-apos-cancelar.png`, `11-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (243 ms)

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
  "organization": "Prefeitura 852770557",
  "closed_by": "Atendente1 852769431",
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
    "actor": "Atendente1 852769431"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 852769431"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 852769431"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 7,
  "status": "queued"
}
```
