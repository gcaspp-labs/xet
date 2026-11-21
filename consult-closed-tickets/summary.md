# Jornada consult-closed-tickets: PASSOU

Commit `d3fb805848ecd31c32bd2e10cebed3ccc990c425`, início 2026-11-21T08:10:25.075Z, duração 9 s.

### Passos

1. ok: Preparar dois setores, órgãos, contatos e chamados encerrados (2616 ms)
2. ok: Atendente abre Atendimentos: só encerrados, mais recentes primeiro, situação de cada um (421 ms): `01-lista-atendente.png`
3. ok: Busca e filtros: texto sem acento, responsável, módulo, assunto e período (1710 ms): `02-assunto-com-sugestao.png`, `03-periodo-sem-resultado.png`
4. ok: Ordem e endereço: clicar em Contato ordena e guarda; recarregar mantém (468 ms): `04-ordem-e-busca-no-endereco.png`
5. ok: Clicar na linha abre a ficha só leitura em /atendimentos/:id (317 ms): `05-ficha.png`
6. ok: Administrador: coluna Setor, Responsável e Módulo travados até escolher o setor (1356 ms): `06-admin-travado.png`, `07-admin-filtrado.png`
7. ok: Estado final no banco e na API (253 ms)

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
