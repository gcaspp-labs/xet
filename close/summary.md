# Jornada close: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:43:18.966Z, duração 7 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (552 ms)
2. ok: Atendente assume o chamado (289 ms)
3. ok: Formulário vazio não encerra e diz o que falta (315 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (869 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (510 ms)
6. ok: Fim antes do início é recusado (118 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (649 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (101 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (309 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (326 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (1331 ms): `08-cancelamento.png`, `09-cancelado-no-historico.png`
12. ok: Estado final do encerramento no banco (232 ms)

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
  "organization": "Prefeitura 598968756",
  "closed_by": "Atendente1 598967464",
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
    "actor": "Atendente1 598967464"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 598967464"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 598967464"
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
