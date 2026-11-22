# Jornada nao-lidas: PASSOU

Commit `742a12f8f059a10650d3162c95ae304c3b776361`, início 2026-11-22T22:00:37.249Z, duração 4 s.

### Passos

1. ok: Preparar setor com um atendente (506 ms)
2. ok: Atendente recebe e assume o chamado da Maria (410 ms): `01-chamado-assumido.png`
3. ok: Com o chamado fechado na lista, a mensagem nova mostra o contador e o negrito (258 ms): `02-nao-lidas-claro.png`
4. ok: O contador segue nos temas escuro e alto contraste (1227 ms): `03-nao-lidas-escuro.png`, `04-nao-lidas-contraste.png`
5. ok: Abrir o chamado zera o contador (270 ms): `05-chamado-aberto-sem-contador.png`
6. ok: Estado final: a leitura foi gravada e não há não lidas (278 ms)

### Estado final observado

Chamado depois de abrir:

```json
{
  "id": 5,
  "status": "in_progress",
  "is_assignee": true,
  "read": true
}
```

Mensagens do cliente depois da leitura:

```json
0
```
