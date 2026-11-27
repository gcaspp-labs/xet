# Jornada link-na-conversa: PASSOU

Commit `106416291d8abaf958388b5d909fd518df3490b1`, início 2026-11-27T14:13:35.397Z, duração 3 s.

### Passos

1. ok: Preparar setor conectado e mensagens com link, www., e-mail e www. colado na fila (643 ms)
2. ok: Atendente abre o chamado da fila e vê os três destinos no texto (454 ms): `01-links-no-balao.png`
3. ok: "www." colado depois de letra, ponto, hífen ou barra fica texto; depois do "(" vira link (119 ms): `02-www-colado-nao-vira-link.png`
4. ok: Clicar no link abre numa aba nova, sem sair da conversa (220 ms): `03-volta-para-a-conversa.png`
5. ok: Responsável assume e responde com link: apelido em negrito e link clicável (565 ms): `04-resposta-com-link.png`
6. ok: Estado final no banco (119 ms)

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
    "body": "abc.www.x.com, abc-www.x.com e a/www.x.com ficam texto; (www.x.com) vira link"
  },
  {
    "direction": "outbound",
    "type": "text",
    "body": "*Atendente1 815398979:*\nO balancete está em https://exemplo.com/balancete.pdf."
  }
]
```
