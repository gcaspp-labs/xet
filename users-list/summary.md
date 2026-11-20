# Jornada users-list: PASSOU

Commit `44ec5ec6f4e6be4b42cf208ea0935af4c09d068c`, início 2026-11-20T21:18:27.325Z, duração 11 s.

### Passos

1. ok: Preparar setores e 26 usuários pela API (3234 ms)
2. ok: Configurações › Usuários abre a página 1, por nome crescente (639 ms): `01-pagina-1.png`
3. ok: Tema escuro (576 ms): `02-pagina-1-escuro.png`
4. ok: Próxima leva à página 2, guardada no endereço (270 ms): `03-pagina-2.png`
5. ok: Situação decrescente: inativos primeiro, volta à página 1 (447 ms): `04-ordem-situacao.png`
6. ok: Setor crescente: quem não tem setor ("Todos") por último (309 ms): `05-ordem-setor.png`
7. ok: Papel crescente: Administrador, Atendente, Supervisor (258 ms): `06-ordem-papel.png`
8. ok: Busca "PRADO" sem acento nem maiúscula, no servidor (604 ms): `07-busca.png`
9. ok: Busca "a" com ordem por setor e página 2; recarregar conserva (594 ms): `08-busca-pagina-ordem.png`
10. ok: Mudar a busca volta à página 1 e mantém a ordem (86 ms)
11. ok: Busca sem resultado (168 ms): `09-busca-sem-resultado.png`
12. ok: Editar continua a partir da lista (541 ms): `10-editar.png`
13. ok: Celular: Papel e Setor viram legenda embaixo do nome (1224 ms): `11-celular.png`
14. ok: Estado final: API e banco (184 ms)

### Estado final observado

Total da busca "a" na API:

```json
26
```

GET /api/users?q=prado&sort=status&direction=desc:

```json
{
  "total": 2,
  "page": 1,
  "pageSize": 20,
  "names": [
    "Fábio Prado",
    "Ângela Prado"
  ],
  "keys": [
    "id",
    "name",
    "email",
    "role",
    "sectorId",
    "nickname",
    "active"
  ]
}
```

Usuários no banco por situação:

```json
[
  {
    "active": false,
    "n": 4
  },
  {
    "active": true,
    "n": 22
  }
]
```
