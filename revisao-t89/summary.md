# Jornada revisao-t89: PASSOU

Commit `f34f7a1d10c434a993bea12625a7d65db1fe7b9c`, início 2026-11-05T17:36:41.093Z, duração 9 s.

### Passos

1. ok: Entrar pela tela e abrir Setores pelo menu (117 ms)
2. ok: Formato inválido fica no formulário; campo opcional após Nome (428 ms): `01-formato-invalido.png`
3. ok: Cadastrar com e-mail e conferir coluna, inclusive espaços removidos (562 ms): `02-cadastro-com-email.png`
4. ok: Dois setores sem e-mail convivem e exibem travessão (1011 ms)
5. ok: Cadastro recusa repetido com outras maiúsculas e HTTP 409 (406 ms): `03-repetido-cadastro.png`
6. ok: Edição recusa repetido e formato inválido (645 ms): `04-repetido-edicao.png`
7. ok: Preencher, trocar, salvar sem mudança e limpar na tela (2103 ms)
8. ok: Tema light, largura 1280, texto Maior: tabela, rolagem e edição (575 ms): `05-light-1280-tabela.png`, `06-light-1280-formulario.png`
9. ok: Tema light, largura 390, texto Maior: tabela, rolagem e edição (577 ms): `07-light-390-tabela.png`, `08-light-390-acoes-apos-rolagem.png`, `09-light-390-formulario.png`
10. ok: Tema dark, largura 1280, texto Maior: tabela, rolagem e edição (646 ms): `10-dark-1280-tabela.png`, `11-dark-1280-formulario.png`
11. ok: Tema dark, largura 390, texto Maior: tabela, rolagem e edição (594 ms): `12-dark-390-tabela.png`, `13-dark-390-acoes-apos-rolagem.png`, `14-dark-390-formulario.png`
12. ok: Banco final confirma email, nulos e auditoria de preencher/trocar/limpar (359 ms)

### Estado final observado

Tabela light 1280:

```json
{
  "clientWidth": 960,
  "scrollWidth": 960,
  "overflow": "auto",
  "pageWidth": 1280,
  "viewport": 1280
}
```

Tabela light 390:

```json
{
  "clientWidth": 356,
  "scrollWidth": 811,
  "overflow": "auto",
  "pageWidth": 390,
  "viewport": 390
}
```

Tabela dark 1280:

```json
{
  "clientWidth": 960,
  "scrollWidth": 960,
  "overflow": "auto",
  "pageWidth": 1280,
  "viewport": 1280
}
```

Tabela dark 390:

```json
{
  "clientWidth": 356,
  "scrollWidth": 811,
  "overflow": "auto",
  "pageWidth": 390,
  "viewport": 390
}
```

Setores no banco:

```json
[
  {
    "id": 1,
    "name": "Financeiro Teste",
    "email": "financeiro@prefeitura-exemplo.test"
  },
  {
    "id": 2,
    "name": "Recursos Humanos Teste",
    "email": null
  },
  {
    "id": 3,
    "name": "Sem Email Teste",
    "email": null
  }
]
```

Auditoria preenchimento/troca/limpeza:

```json
[
  {
    "action": "sector_created",
    "changes": {
      "name": {
        "to": "Recursos Humanos Teste",
        "from": null
      },
      "provider": {
        "to": "whatsmeow",
        "from": null
      }
    }
  },
  {
    "action": "sector_updated",
    "changes": {
      "email": {
        "to": "rh@prefeitura-exemplo.test",
        "from": null
      }
    }
  },
  {
    "action": "sector_updated",
    "changes": {
      "email": {
        "to": "pessoas@prefeitura-exemplo.test",
        "from": "rh@prefeitura-exemplo.test"
      }
    }
  },
  {
    "action": "sector_updated",
    "changes": {
      "email": {
        "to": null,
        "from": "pessoas@prefeitura-exemplo.test"
      }
    }
  }
]
```

Auditoria cadastro com e-mail:

```json
[
  {
    "changes": {
      "name": {
        "to": "Financeiro Teste",
        "from": null
      },
      "email": {
        "to": "financeiro@prefeitura-exemplo.test",
        "from": null
      },
      "provider": {
        "to": "whatsmeow",
        "from": null
      }
    }
  }
]
```
