# Jornada dashboard-canal: PASSOU

Commit `b758eba9dc847a7846b3dc6481261915466fa2b4`, início 2026-11-21T03:27:33.630Z, duração 4 s.

### Passos

1. ok: Preparar setor, órgão, contatos e um encerrado do WhatsApp (1034 ms)
2. ok: Abrir o Dashboard com todos os canais (298 ms): `01-todos-os-canais.png`
3. ok: Filtrar por Telefone: só o registro por telefone conta (579 ms): `02-canal-telefone.png`
4. ok: A tabela por atendente mostra "—" só nas colunas fora do filtro (233 ms): `03-canal-telefone-tabela.png`
5. ok: Trocar para WhatsApp deixa o registro por telefone de fora (394 ms): `04-canal-whatsapp.png`
6. ok: Estado final no banco (243 ms)

### Estado final observado

Encerrados por canal no setor:

```json
[
  {
    "channel": "whatsapp",
    "count": 1
  },
  {
    "channel": "phone",
    "count": 1
  }
]
```

Registro por telefone: responsável e tempos:

```json
[
  {
    "status": "closed",
    "channel": "phone",
    "closure_type": "resolved",
    "responsavel_registrou": true,
    "segundos_da_ligacao": 900
  }
]
```
