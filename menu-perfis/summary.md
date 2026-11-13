# Jornada menu-perfis: PASSOU

Commit `184779510eac2cf4b43bbdd2089ebb611ac02daf`, início 2026-11-13T17:03:13.537Z, duração 4 s.

### Passos

1. ok: Preparar setor e pessoas (380 ms)
2. ok: Entrada e menu: administrador (1277 ms): `01-administrador-inicio.png`, `02-administrador-atendimento.png`
3. ok: Entrada e menu: supervisor (1101 ms): `03-supervisor-inicio.png`, `04-supervisor-atendimento.png`
4. ok: Entrada e menu: atendente (1121 ms): `05-atendente-inicio.png`, `06-atendente-atendimento.png`
5. ok: Estado final dos perfis preparados (118 ms)

### Estado final observado

Perfis do setor de teste:

```json
[
  {
    "role": "agent"
  },
  {
    "role": "supervisor"
  }
]
```

#### Comparação com o protótipo aprovado da #109

O Dashboard aparece solto acima de Helpdesk para supervisor e administrador, sem item para atendente, e seu cabeçalho mostra só o setor. Conversas consta no menu por entrega posterior ao protótipo; a #159 define Conversas como início do atendente.
