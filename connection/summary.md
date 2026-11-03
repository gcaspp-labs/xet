# Jornada connection: PASSOU

Commit `5549f925a0ce3210cbea567f99298f6984756ef8`, início 2026-11-03T14:21:24.198Z, duração 6 s.

### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (571 ms)
2. ok: Número nunca conectado: o painel avisa e leva à tela de conexão (315 ms): `01-aviso-no-painel.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (279 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (232 ms): `04-conectado.png`
5. ok: Queda da conexão: o aviso aparece no painel, sem recarregar (243 ms): `05-queda-no-painel.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (179 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1239 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (817 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso, e a rota o devolve ao painel (779 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (432 ms)

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
    "actor": "Supervisor 684199001"
  }
]
```
