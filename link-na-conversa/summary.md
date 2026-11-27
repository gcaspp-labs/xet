# Jornada link-na-conversa: PASSOU

Commit `47603cdc671ae08edb1c06862dd8d7db85b4ba0b`, início 2026-11-27T12:53:19.428Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado e mensagem com link, www. e e-mail na fila (815 ms)
2. ok: Atendente abre o chamado da fila e vê os três destinos no texto (536 ms): `01-links-no-balao.png`
3. ok: Clicar no link abre numa aba nova, sem sair da conversa (249 ms): `02-volta-para-a-conversa.png`
4. ok: Responsável assume e responde com link: apelido em negrito e link clicável (705 ms): `03-resposta-com-link.png`
5. ok: Estado final no banco (198 ms)

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
    "direction": "outbound",
    "type": "text",
    "body": "*Atendente1 999428250:*\nO balancete está em https://exemplo.com/balancete.pdf."
  }
]
```
