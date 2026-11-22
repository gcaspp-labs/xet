# Jornada unread-count: PASSOU

Commit `4e63d1729ea2424a8d3eaeb4cc06fb290b418922`, início 2026-11-22T17:32:47.495Z, duração 3 s.

### Passos

1. ok: Preparar setor conectado e um atendente (567 ms)
2. ok: Mensagem do cliente abre chamado na fila, sem não lidas (341 ms): `01-fila-sem-nao-lidas.png`
3. ok: Assumir o chamado começa a leitura do responsável (410 ms)
4. ok: Resposta do cliente conta uma não lida na lista (134 ms): `02-meus-chamados-com-nao-lida.png`
5. ok: Marcar como lido zera a contagem do responsável (201 ms): `03-meus-chamados-lido.png`

### Estado final observado

unreadCount na fila:

```json
0
```

assignee_read_at depois de assumir:

```json
"2026-11-22T17:32:49.580358+00:00"
```

unreadCount com uma resposta do cliente:

```json
1
```

unreadCount depois da leitura:

```json
0
```

assignee_read_at depois da leitura:

```json
"2026-11-22T17:32:50.12388+00:00"
```
