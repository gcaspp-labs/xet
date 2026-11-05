# Jornada connection: PASSOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:51:40.899Z, duração 4 s.

### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (251 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (308 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (222 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (229 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (279 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (310 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (803 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (417 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (622 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (133 ms)

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
    "actor": "Supervisor 900900364"
  }
]
```
