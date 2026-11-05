# Jornada dashboard-ui: PASSOU

Commit `e63d43b3795017285716598cb3106836e2b2530e`, início 2026-11-05T01:15:31.327Z, duração 21 s.

### Passos

1. ok: Preparar setores, dois atendentes, módulos e órgão (891 ms)
2. ok: Supervisor entra pelo menu e vê só o próprio setor (568 ms): `01-supervisor-proprio-setor.png`
3. ok: Atendente não vê o menu e endereço o devolve ao painel (277 ms)
4. ok: Assumir no painel atualiza dashboard sem recarregar (372 ms): `02-atendimento-tempo-real.png`
5. ok: Preparar encerrado registrado para os filtros (295 ms)
6. ok: Mensagem nova atualiza fila e recebidos sem recarregar (207 ms): `03-novo-chamado-tempo-real.png`
7. ok: Datas mudam números do período e mantêm fila atual (684 ms)
8. ok: Atendente e módulo mudam números e mostram não aplicáveis (1829 ms): `04-filtro-modulo.png`
9. ok: Órgão filtra e filtros sobrevivem ao recarregar (1291 ms)
10. ok: Administrador alterna setores e limpa filtros dependentes (1528 ms): `05-administrador-todos-setores.png`
11. ok: Sem rolagem horizontal: 1280px, Claro, texto Padrão (882 ms): `06-dashboard-1280-Claro-Padrão.png`
12. ok: Sem rolagem horizontal: 1280px, Claro, texto Maior (992 ms): `07-dashboard-1280-Claro-Maior.png`
13. ok: Sem rolagem horizontal: 1280px, Escuro, texto Padrão (930 ms): `08-dashboard-1280-Escuro-Padrão.png`
14. ok: Sem rolagem horizontal: 1280px, Escuro, texto Maior (932 ms): `09-dashboard-1280-Escuro-Maior.png`
15. ok: Sem rolagem horizontal: 375px, Claro, texto Padrão (1376 ms): `10-dashboard-375-Claro-Padrão.png`
16. ok: Sem rolagem horizontal: 375px, Claro, texto Maior (1333 ms): `11-dashboard-375-Claro-Maior.png`
17. ok: Sem rolagem horizontal: 375px, Escuro, texto Padrão (1305 ms): `12-dashboard-375-Escuro-Padrão.png`
18. ok: Sem rolagem horizontal: 375px, Escuro, texto Maior (1213 ms): `13-dashboard-375-Escuro-Maior.png`
19. ok: Estado final no banco corresponde ao dashboard (158 ms)

### Estado final observado

Chamados dos setores:

```json
[
  {
    "sector_id": 1,
    "status": "closed",
    "total": 1
  },
  {
    "sector_id": 1,
    "status": "queued",
    "total": 2
  },
  {
    "sector_id": 2,
    "status": "queued",
    "total": 1
  }
]
```
