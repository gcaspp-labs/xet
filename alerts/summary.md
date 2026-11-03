# Jornada alerts: PASSOU

Commit `6d09eea59c8481dc0d02acff74a03af62b0373ba`, início 2026-11-03T23:04:59.428Z, duração 13 s.

### Passos

1. ok: Preparar setor conectado e atendente (424 ms)
2. ok: Entrar sem pedir permissão, sem alertas, título sem contador (158 ms): `01-fila-vazia.png`
3. ok: Opções desligadas: chamado só aparece no app (141 ms)
4. ok: Ativar pelo menu; aba visível toca som sem notificação (1184 ms): `02-preferencias-ligadas.png`
5. ok: Aba oculta: notificação com nome, sem mensagem; som curto é iniciado (1097 ms): `03-chamado-e-contador.png`
6. ok: Evento de clique foca a aba e abre a conversa do contato (220 ms): `04-conversa-do-alerta.png`
7. ok: Recarregar conserva opções e não repete alertas (1357 ms)
8. ok: Queda real do WebSocket: chamado durante a queda não alerta ao reconectar (3025 ms)
9. ok: Desligar as duas opções impede novos alertas (2289 ms)
10. ok: Assumir todos pelo sino: contador e título voltam a zero (1156 ms): `05-todos-assumidos.png`
11. ok: Sair restaura o título padrão (303 ms)
12. ok: Estado final no banco (127 ms)

### Estado final observado

Notificações reais do Chromium, interceptadas após criação:

```json
[
  {
    "title": "Chamado recebido",
    "body": "Caio Oculto",
    "tag": "ticket-3",
    "visibility": "hidden"
  }
]
```

Alertas depois do reload e da reconexão:

```json
[
  {
    "title": "Chamado recebido",
    "body": "Davi Depois",
    "tag": "ticket-4",
    "visibility": "hidden"
  },
  {
    "title": "Chamado recebido",
    "body": "Fábio Depois",
    "tag": "ticket-6",
    "visibility": "hidden"
  }
]
```

Estado final no banco, setor 1:

```json
[
  {
    "status": "in_progress",
    "total": 8
  }
]
```
