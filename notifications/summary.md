# Jornada notifications: PASSOU

Commit `6a2d0b04128a403717916da7b6ce948e6841dce1`, início 2026-11-03T20:35:59.195Z, duração 23 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (661 ms)
2. ok: Primeira carga: mostra o que já estava na fila, sem aviso (1611 ms): `01-primeira-carga.png`
3. ok: Chamado novo sobe o contador, avisa sem botão e mostra o item, sem recarregar (628 ms): `02-aviso-e-contador.png`, `03-lista-do-sino.png`
4. ok: Recarregar a página não repete o aviso (1699 ms)
5. ok: "Abrir" leva à conversa, e o chamado segue na fila (362 ms)
6. ok: Assumir pelo sino não muda a tela nem apaga o texto em digitação (691 ms): `04-assumido-sem-mudar-tela.png`
7. ok: Outra pessoa assume: o item sai (609 ms)
8. ok: Devolvido à fila: o item volta (1096 ms): `05-devolvido-volta-ao-sino.png`
9. ok: Outra pessoa cancela: o item sai (778 ms): `06-sino-vazio.png`
10. ok: Quem perde a disputa vê o erro dentro da lista (1296 ms): `07-erro-na-lista.png`
11. ok: Rede cai e volta: o chamado da queda aparece, sem aviso (510 ms): `08-volta-da-rede.png`
12. ok: WebSocket cai e reconecta: o chamado da queda aparece, sem aviso (3979 ms): `09-websocket-caido.png`, `10-websocket-de-volta.png`
13. ok: Atendente de outro setor não vê o chamado nem o número desconectado (806 ms): `11-atendente-outro-setor.png`
14. ok: Supervisor de outro setor não vê o número deste nem a faixa antiga (382 ms)
15. ok: Supervisor vê o número desconectado, em alerta, sem a faixa (494 ms): `12-contador-em-alerta-claro.png`, `13-item-numero-desconectado.png`, `14-item-numero-desconectado-escuro.png`, `15-contador-em-alerta-escuro.png`
16. ok: O item leva à tela do setor e só sai ao conectar (655 ms): `16-item-durante-conexao.png`, `17-conectado-sem-item.png`
17. ok: Número cai com a tela aberta: o item volta sem recarregar (56 ms)
18. ok: Administrador vê número desconectado, em alerta, e os setores identificados (814 ms): `18-administrador-varios-setores.png`, `19-administrador-tela-do-setor.png`, `20-administrador-queda-ao-vivo.png`
19. ok: Administrador recebe o aviso de um setor e assume pelo sino (433 ms)
20. ok: O sino aparece nas outras telas (668 ms)
21. ok: Funciona na largura do celular, com lista longa (1403 ms): `21-celular-cabecalho.png`, `22-celular-lista.png`, `23-celular-fim-da-lista.png`, `24-celular-assumido.png`
22. ok: Estado final no banco (266 ms)

### Estado final observado

Avisos vistos pelo atendente até a devolução:

```json
[
  "Chamado recebido: Carla Fila"
]
```

Avisos na queda da rede:

```json
[
  "Chamado recebido: Gabi Antes",
  "Chamado recebido: Iara Depois"
]
```

Avisos na queda do WebSocket:

```json
[
  "Chamado recebido: Kelly Depois"
]
```

Chamados do setor:

```json
[
  {
    "contato": "Ana Antiga",
    "status": "in_progress",
    "assignee_id": 3
  },
  {
    "contato": "Bruno Novo",
    "status": "in_progress",
    "assignee_id": 3
  },
  {
    "contato": "Carla Fila",
    "status": "closed",
    "assignee_id": 2
  },
  {
    "contato": "Davi Disputado",
    "status": "in_progress",
    "assignee_id": 3
  },
  {
    "contato": "Gabi Antes",
    "status": "in_progress",
    "assignee_id": 4
  },
  {
    "contato": "Hugo Durante",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Iara Depois",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Joana Na Queda",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Kelly Depois",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Mario Admin",
    "status": "in_progress",
    "assignee_id": 1
  },
  {
    "contato": "Contato Longo 1",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 2",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 3",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 4",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 5",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 6",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 7",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 8",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 9",
    "status": "queued",
    "assignee_id": null
  }
]
```
