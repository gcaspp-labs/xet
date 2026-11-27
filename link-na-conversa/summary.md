# Jornada link-na-conversa: PASSOU

Commit `49f04289b8d0976c7f992c7443b7d2bfa4c3cb4e`, início 2026-11-27T13:43:39.088Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado e mensagem com link, www., e-mail e www. colado na fila (825 ms)
2. ok: Atendente abre o chamado da fila e vê os três destinos no texto (551 ms): `01-links-no-balao.png`
3. ok: "www." colado no meio da palavra fica texto; depois do "(" vira link (129 ms): `02-www-colado-nao-vira-link.png`
4. ok: Clicar no link abre numa aba nova, sem sair da conversa (257 ms): `03-volta-para-a-conversa.png`
5. ok: Responsável assume e responde com link: apelido em negrito e link clicável (737 ms): `04-resposta-com-link.png`
6. ok: Estado final no banco (145 ms)

### Estado final observado

Mensagens do chamado:

```json
[
  {
    "direction": "inbound",
    "type": "text",
    "body": "Site https://exemplo.com/a?b=1, www.exemplo.com e fulano@exemplo.com.br."
  },
  {
    "direction": "inbound",
    "type": "text",
    "body": "abc.www.x.com fica texto e (www.x.com) vira link"
  },
  {
    "direction": "outbound",
    "type": "text",
    "body": "*Atendente1 019089675:*\nO balancete está em https://exemplo.com/balancete.pdf."
  }
]
```
