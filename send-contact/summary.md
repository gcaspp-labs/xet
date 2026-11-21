# Jornada send-contact: PASSOU

Commit `3224c3f0c8668cc65ca08d3890b32f9c8c2ba225`, início 2026-11-21T15:21:14.848Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado, atendente e um contato cadastrado no órgão (815 ms)
2. ok: O clipe abre o menu com Arquivo e Contato (272 ms): `01-menu-do-anexo.png`
3. ok: Contato abre a busca em Meu setor, com os filtros (308 ms): `02-busca.png`
4. ok: A busca em Todos os setores mostra nome, telefone e órgão com o município (532 ms): `03-resultado.png`
5. ok: Escolher o contato mostra a prévia do cartão (202 ms): `04-previa.png`
6. ok: Voltar devolve a lista com a busca, o filtro e o foco na linha escolhida (216 ms): `05-voltar-lista.png`
7. ok: A linha em foco volta à prévia e Enviar entrega o cartão na conversa (547 ms): `06-enviado.png`
8. ok: Estado final no banco (138 ms)

### Estado final observado

Mensagens do chamado:

```json
[
  {
    "type": "text",
    "status": null,
    "accepted_by_provider": true,
    "contact_cards": null
  },
  {
    "type": "contact",
    "status": "sent",
    "accepted_by_provider": true,
    "contact_cards": "[{\"name\": \"Joana Alves 1\", \"phones\": [{\"phone\": \"5511000000001\", \"wa_id\": null}], \"organization\": \"Prefeitura 474849597 — Campinas\"}]"
  }
]
```
