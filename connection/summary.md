# Jornada connection: PASSOU

Commit `f34f7a1d10c434a993bea12625a7d65db1fe7b9c`, início 2026-11-05T17:36:50.262Z, duração 6 s.

### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (413 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (502 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (260 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (341 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (384 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (401 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (924 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (650 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (742 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (284 ms)

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
    "actor": "Supervisor 210263932"
  }
]
```
