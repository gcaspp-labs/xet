# Jornada password-eye: PASSOU

Commit `36176d75abc63a2ef4a39f42494cc218255be191`, início 2026-11-18T12:34:16.609Z, duração 5 s.

### Passos

1. ok: Preparar setor com um atendente (511 ms)
2. ok: Login (claro): senha começa escondida e o olho alterna (1008 ms): `01-login-escondida-claro.png`, `02-login-visivel-foco-claro.png`, `03-login-senha-incorreta-claro.png`, `04-login-erro-vazio-claro.png`
3. ok: Login (escuro): senha começa escondida e o olho alterna (995 ms): `05-login-escondida-escuro.png`, `06-login-visivel-foco-escuro.png`, `07-login-senha-incorreta-escuro.png`, `08-login-erro-vazio-escuro.png`
4. ok: Usuários → Novo usuário: olho na Senha inicial (727 ms): `09-usuarios-senha-inicial-visivel.png`
5. ok: Usuários → Editar → Redefinir senha: olho na Nova senha e volta a esconder ao enviar (456 ms): `10-usuarios-nova-senha-visivel.png`, `11-usuarios-nova-senha-erro-escondida.png`
6. ok: Estado final no banco (242 ms)

### Estado final observado

Tentativas erradas do atendente (2 logins errados, um por tema):

```json
[
  {
    "failures": 2
  }
]
```

Sessões do atendente (nenhuma: não entrou):

```json
[
  {
    "sessions": 0
  }
]
```
