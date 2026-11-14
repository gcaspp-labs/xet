# Jornada ficha-177: PASSOU

Commit `fa18fb421eb95b887a53658ed2cedb9dd540f060`, início 2026-11-14T18:52:29.114Z, duração 6 s.

### Passos

1. ok: Preparar setor com dois atendentes, módulo, órgão, contato cadastrado e duas conversas (842 ms)
2. ok: Atendente assume e encerra o chamado de Rita pela tela Chamados (848 ms): `01-encerrado-volta-aos-chamados.png`
3. ok: Atendente cancela o chamado de Paula (435 ms)
4. ok: Pelo menu Atendimentos, a linha de Rita abre a ficha só leitura (414 ms): `02-ficha-encerrado-com-corrigir.png`
5. ok: Corrigir abre na própria ficha e a correção entra na conversa (636 ms): `03-correcao-aberta.png`, `04-ficha-depois-da-correcao.png`
6. ok: Aba Histórico lista os chamados do contato com link para /atendimentos/:id (170 ms): `05-ficha-historico.png`
7. ok: Chamado cancelado: ficha só leitura, sem Corrigir nem para o atendente que cancelou (306 ms): `06-ficha-cancelado.png`
8. ok: Outro atendente lê a ficha de Rita, sem Corrigir (751 ms): `07-ficha-outro-atendente-sem-corrigir.png`
9. ok: Supervisor do setor vê o Corrigir (778 ms): `08-ficha-supervisor-com-corrigir.png`
10. ok: Estado final no banco (341 ms)

### Estado final observado

Chamados:

```json
[
  {
    "id": 5,
    "status": "closed",
    "closure_type": "resolved",
    "resolution": "Segunda via enviada por e-mail."
  },
  {
    "id": 6,
    "status": "closed",
    "closure_type": "cancelled",
    "resolution": null
  }
]
```

Auditoria:

```json
[
  {
    "ticket_id": 5,
    "action": "ticket_closed",
    "reason": null
  },
  {
    "ticket_id": 6,
    "action": "ticket_cancelled",
    "reason": "Golpe do falso boleto."
  },
  {
    "ticket_id": 5,
    "action": "ticket_corrected",
    "reason": "Resolução incompleta."
  }
]
```
