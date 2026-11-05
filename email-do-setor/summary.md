# Jornada email-do-setor: PASSOU

Commit `f34f7a1d10c434a993bea12625a7d65db1fe7b9c`, início 2026-11-05T17:32:09.896Z, duração 9 s.

### Passos

1. ok: Preparar um setor, porque o banco da execução começa vazio (245 ms)
2. ok: Abrir a tela de setores (154 ms)
3. ok: Cadastro recusa formato inválido (335 ms): `01-formato-invalido.png`
4. ok: Cadastro grava o e-mail e a tabela mostra (455 ms)
5. ok: Setor sem e-mail mostra travessão (521 ms)
6. ok: Repetido com outras maiúsculas é recusado (343 ms): `02-email-repetido.png`
7. ok: Edição troca e limpa (1186 ms)
8. ok: Preparar um e-mail longo para as capturas (516 ms)
9. ok: Tema light, desktop, texto Maior (1064 ms): `03-tabela-light-desktop.png`, `04-formulario-light-desktop.png`
10. ok: Tema light, celular, texto Maior (988 ms): `05-tabela-light-celular.png`, `06-formulario-light-celular.png`
11. ok: Tema dark, desktop, texto Maior (1025 ms): `07-tabela-dark-desktop.png`, `08-formulario-dark-desktop.png`
12. ok: Tema dark, celular, texto Maior (891 ms): `09-tabela-dark-celular.png`, `10-formulario-dark-celular.png`
13. ok: Estado final no banco (233 ms)

### Estado final observado

Setores da jornada:

```json
[
  {
    "name": "Financeiro mw3tp8o5",
    "email": "atendimento.financeiro.mw3tp8o5@prefeitura-exemplo.test"
  },
  {
    "name": "Sem e-mail mw3tp8o5",
    "email": null
  }
]
```

Auditoria:

```json
[
  {
    "action": "sector_created",
    "email": {
      "to": "financeiro.mw3tp8o5@exemplo.test",
      "from": null
    }
  },
  {
    "action": "sector_updated",
    "email": {
      "to": "contas.mw3tp8o5@exemplo.test",
      "from": "financeiro.mw3tp8o5@exemplo.test"
    }
  },
  {
    "action": "sector_updated",
    "email": {
      "to": null,
      "from": "contas.mw3tp8o5@exemplo.test"
    }
  },
  {
    "action": "sector_updated",
    "email": {
      "to": "atendimento.financeiro.mw3tp8o5@prefeitura-exemplo.test",
      "from": null
    }
  }
]
```
