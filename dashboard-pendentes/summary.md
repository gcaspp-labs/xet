# Jornada dashboard-pendentes: PASSOU

Commit `50a8166c80846c45a61e7b02b8b6ed01aafdd56f`, início 2026-11-25T01:35:16.964Z, duração 3 s.

### Passos

1. ok: Preparar setor com um atendente e um supervisor (247 ms)
2. ok: Cliente escreve e o atendente marca o chamado como pendente (79 ms)
3. ok: Supervisor vê o quadro Pendentes com a quantidade e a linha (253 ms): `01-quadro-pendentes.png`
4. ok: Clicar na linha abre o chamado (138 ms): `02-linha-abre-o-chamado.png`
5. ok: "Ver todos" abre Chamados na aba Pendentes, sem mudar a aba padrão (222 ms): `03-ver-todos-aba-pendentes.png`
6. ok: Sem pendentes, o quadro diz "Nenhum chamado pendente" (869 ms): `04-quadro-vazio.png`
7. ok: Estado final no banco (115 ms)

### Estado final observado

Chamado pendente:

```json
[
  {
    "status": "pending",
    "pending_reason": "Aguardando o balancete do órgão"
  }
]
```

Pendentes do setor:

```json
[
  {
    "n": 1
  }
]
```
