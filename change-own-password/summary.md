# Jornada change-own-password: PASSOU

Commit `f5b748d36c19db05e81b390272e9366b6be6d826`, início 2026-11-19T10:28:12.197Z, duração 6 s.

### Passos

1. ok: Preparar setor e atendente com senha conhecida (464 ms)
2. ok: Menu Configurações mostra "Alterar senha" antes de "Sair" (236 ms): `01-menu.png`
3. ok: Diálogo vazio com a dica da regra embaixo de "Nova senha" (190 ms): `02-vazio.png`
4. ok: Atual vazia e confirmação diferente: erro no formulário, sem chamar a API (271 ms): `03-confirmacao.png`
5. ok: Senha atual incorreta: erro em "Senha atual" (375 ms): `04-atual-incorreta.png`
6. ok: Regra da senha: mensagem da redefinição em "Nova senha" (223 ms): `05-politica.png`
7. ok: Senha comum: recusada pelo servidor em "Nova senha" (330 ms): `06-comum.png`
8. ok: Longa demais: recusada em "Nova senha" (209 ms): `07-longa.png`
9. ok: Nova igual à atual: recusada em "Nova senha" (315 ms): `08-igual.png`
10. ok: Sucesso: diálogo fecha e aparece "Senha alterada" (1047 ms): `09-sucesso.png`
11. ok: Esta sessão continua; a outra sessão do usuário cai (478 ms): `10-sessao-atual.png`, `11-outra-sessao.png`
12. ok: Estado final no banco (247 ms)

### Estado final observado

Sessões do atendente:

```json
{
  "quantidade": 1
}
```

Auditoria do atendente:

```json
[
  {
    "action": "user_created",
    "actor_id": 1
  },
  {
    "action": "user_password_reset",
    "actor_id": 1
  },
  {
    "action": "user_password_changed",
    "actor_id": 3
  }
]
```
