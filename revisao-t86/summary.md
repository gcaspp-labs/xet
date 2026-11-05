# Jornada revisao-t86: PASSOU

Commit `8d907dd7f8ad1da5ad5ce2a3e9cf1071e96097fb`, início 2026-11-05T15:25:50.317Z, duração 15 s.

### Passos

1. ok: Preparar setor conectado, módulos e dois chamados fictícios (671 ms)
2. ok: Sem preferência, as duas seções começam abertas e os números carregam (297 ms): `01-dashboard-inicial.png`
3. ok: Select com escolha abre abaixo em tela cheia; clique, teclado e Escape funcionam (968 ms): `02-select-tela-abaixo.png`
4. ok: Select no fim da tela abre acima sem cobrir o campo (378 ms): `03-select-tela-acima.png`
5. ok: Recolher preserva títulos, datas, filtros e tabela com dados (1009 ms): `04-duas-recolhidas-filtros-tabela.png`
6. ok: Preferência sobrevive ao reload; reabrir por Espaço e clique mantém independência (627 ms)
7. ok: Select em janela abre abaixo e escolhe por clique e teclado (1256 ms): `05-select-janela-abaixo.png`
8. ok: Select em janela curta abre acima e escolhe sem fechar a janela (825 ms): `06-select-janela-acima.png`
9. ok: Claro, desktop, texto Maior: dashboard, lista e sino sem rolagem horizontal (1354 ms): `07-Claro-1280-dashboard.png`, `08-Claro-1280-lista.png`, `09-Claro-1280-sino.png`
10. ok: Claro, celular, texto Maior: dashboard, lista e sino sem rolagem horizontal (1147 ms): `10-Claro-375-dashboard.png`, `11-Claro-375-lista.png`, `12-Claro-375-sino.png`
11. ok: Escuro, desktop, texto Maior: dashboard, lista e sino sem rolagem horizontal (1400 ms): `13-Escuro-1280-dashboard.png`, `14-Escuro-1280-lista.png`, `15-Escuro-1280-sino.png`
12. ok: Escuro, celular, texto Maior: dashboard, lista e sino sem rolagem horizontal (1079 ms): `16-Escuro-375-dashboard.png`, `17-Escuro-375-lista.png`, `18-Escuro-375-sino.png`
13. ok: Armazenamento bloqueado: recolher funciona, persiste na navegação e reinicia aberto no reload (1551 ms)
14. ok: Estado final do banco: somente a ação de assumir alterou os chamados (299 ms)

### Estado final observado

Filtros e tabela preservados:

```json
{
  "url": "http://127.0.0.1:25173/dashboard?period=7d",
  "table": "Por atendente\nATENDENTE\tEM ATENDIMENTO\tINICIADOS\tENCERRADOS\tTRANSFERIDOS\tCANCELADOS\tTEMPO MÉDIO DE ATENDIMENTO\nSupervisor 350317185\t1\t0\t0\t0\t0\t—",
  "dates": "30/10/2026 a 05/11/2026"
}
```

Chamados fictícios no banco:

```json
[
  {
    "status": "in_progress",
    "assignee_id": 20
  },
  {
    "status": "queued",
    "assignee_id": null
  }
]
```

Auditoria:

```json
[
  {
    "action": "ticket_assigned"
  }
]
```
