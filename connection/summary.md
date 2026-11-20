# Jornada connection: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:28:13.901Z, duração 8 s.

### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (769 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (616 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (306 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (388 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (490 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (416 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1162 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (1146 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve à tela Chamados (1255 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (523 ms)

### Estado final observado

Atendente tentando conectar pela API:

```json
{
  "http": 403
}
```

Setor:

```json
{
  "connection_status": "logged_out",
  "phone": null,
  "external_account_id": null
}
```

Auditoria da conexão:

```json
[
  {
    "action": "sector_connected",
    "actor": null
  },
  {
    "action": "sector_disconnected",
    "actor": null
  },
  {
    "action": "sector_connected",
    "actor": null
  },
  {
    "action": "sector_disconnected",
    "actor": "Supervisor 093902773"
  }
]
```
