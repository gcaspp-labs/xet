# Jornada phone-record: PASSOU

Commit `72c6f74b98df0ef9cbbf51bac113add8197116cd`, início 2026-11-21T05:40:13.875Z, duração 4 s.

### Passos

1. ok: Preparar setor, contato cadastrado, chamado de WhatsApp encerrado e registro por telefone (983 ms)
2. ok: Lista: só o registro por telefone ganha a marca Telefone, abaixo da situação (252 ms): `01-lista-com-marca.png`
3. ok: Filtro Canal: Telefone recorta a lista, fica no endereço e sobrevive a recarregar (1227 ms): `02-filtro-telefone.png`, `03-filtro-whatsapp.png`
4. ok: Ficha: dados do registro e, no lugar da conversa, "Atendimento por telefone, sem conversa" (355 ms): `04-ficha-sem-conversa.png`
5. ok: Histórico do contato e do órgão: o registro entra na lista com a marca Telefone (244 ms): `05-historico-com-marca.png`
6. ok: Estado final no banco e na API (148 ms)

### Estado final observado

Chamados do setor, por canal (banco):

```json
"[{\"protocol\":\"2026-000011\",\"channel\":\"whatsapp\",\"status\":\"closed\",\"closure_type\":\"resolved\"},{\"protocol\":\"2026-000012\",\"channel\":\"phone\",\"status\":\"closed\",\"closure_type\":\"resolved\"}]"
```

Atendimentos no canal telefone (API):

```json
"HTTP 200 · 1 registro(s)"
```
