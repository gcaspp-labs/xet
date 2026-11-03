# Jornada alerts: PASSOU

Commit `e4211912fdf6e431cd23829584516ebaa46077b9`, início 2026-11-03T23:30:06.229Z, duração 14 s.

### Passos

1. ok: Preparar setor conectado e atendente (437 ms)
2. ok: Entrar sem pedir permissão, sem alertas, título sem contador (191 ms): `01-fila-vazia.png`
3. ok: Opções desligadas: chamado só aparece no app (111 ms)
4. ok: Ativar pelo menu; aba visível toca som sem notificação (1103 ms): `02-preferencias-ligadas.png`
5. ok: Aba oculta: notificação com nome, sem mensagem; som curto é iniciado (1100 ms): `03-chamado-e-contador.png`
6. ok: Evento de clique foca a aba e abre a conversa do contato (138 ms): `04-conversa-do-alerta.png`
7. ok: Recarregar conserva opções e não repete alertas (1285 ms)
8. ok: Queda real do WebSocket: chamado durante a queda não alerta ao reconectar (3923 ms)
9. ok: Desligar as duas opções impede novos alertas (2448 ms)
10. ok: Assumir todos pelo sino: contador e título voltam a zero (1143 ms): `05-todos-assumidos.png`
11. ok: Sair restaura o título padrão (290 ms)
12. ok: Estado final no banco (124 ms)

### Estado final observado

Notificações reais do Chromium, interceptadas após criação:

```json
[
  {
    "title": "Chamado recebido",
    "body": "Caio Oculto",
    "tag": "ticket-7",
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
    "tag": "ticket-8",
    "visibility": "hidden"
  },
  {
    "title": "Chamado recebido",
    "body": "Fábio Depois",
    "tag": "ticket-10",
    "visibility": "hidden"
  }
]
```

Estado final no banco, setor 2:

```json
[
  {
    "status": "in_progress",
    "total": 8
  }
]
```
