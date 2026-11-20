# Jornada consult-closed-tickets: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:28:22.994Z, duração 13 s.

### Passos

1. ok: Preparar dois setores, órgãos, contatos e chamados encerrados (5110 ms)
2. ok: Atendente abre Atendimentos: só encerrados, mais recentes primeiro, situação de cada um (463 ms): `01-lista-atendente.png`
3. ok: Busca e filtros: texto sem acento, responsável, módulo, assunto e período (2161 ms): `02-assunto-com-sugestao.png`, `03-periodo-sem-resultado.png`
4. ok: Ordem e endereço: clicar em Contato ordena e guarda; recarregar mantém (599 ms): `04-ordem-e-busca-no-endereco.png`
5. ok: Clicar na linha abre a ficha só leitura em /atendimentos/:id (409 ms): `05-ficha.png`
6. ok: Administrador: coluna Setor, Responsável e Módulo travados até escolher o setor (1737 ms): `06-admin-travado.png`, `07-admin-filtrado.png`
7. ok: Estado final no banco e na API (529 ms)

### Estado final observado

Chamados encerrados do setor (banco):

```json
"[{\"closure_type\":\"transferred\",\"has_closed_at\":true},{\"closure_type\":\"cancelled\",\"has_closed_at\":true},{\"closure_type\":\"resolved\",\"has_closed_at\":true},{\"closure_type\":\"resolved\",\"has_closed_at\":true}]"
```

Chamados abertos do setor, fora da lista (banco):

```json
"[{\"n\":1}]"
```

Filtro de situação na API:

```json
"HTTP 400"
```

Setor de outro, para atendente:

```json
"HTTP 403"
```
