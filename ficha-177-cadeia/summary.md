# Jornada ficha-177-cadeia: PASSOU

Commit `fa18fb421eb95b887a53658ed2cedb9dd540f060`, início 2026-11-14T18:53:46.498Z, duração 5 s.

### Passos

1. ok: Preparar origem e destino, contato cadastrado e conversa na origem (967 ms)
2. ok: Origem assume e transfere para outro setor pela tela Chamados (1196 ms)
3. ok: Ficha da origem mostra a cadeia com o destino e o rodapé Transferido (260 ms): `01-ficha-origem-cadeia.png`
4. ok: Destino cancela o chamado novo e a ficha dele liga à origem (1277 ms): `02-ficha-destino-cadeia.png`, `03-ficha-origem-vista-do-destino.png`
5. ok: Estado final no banco (241 ms)

### Estado final observado

Chamados:

```json
[
  {
    "id": 10,
    "sector_id": 7,
    "status": "closed",
    "closure_type": "transferred"
  },
  {
    "id": 11,
    "sector_id": 8,
    "status": "closed",
    "closure_type": "cancelled"
  }
]
```
