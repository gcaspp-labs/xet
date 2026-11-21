# Jornada send-contact: PASSOU

Commit `4f81839b58487d799af004d7c19a5a15840c5b33`, início 2026-11-21T15:51:21.027Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado, atendente e um contato cadastrado no órgão (601 ms)
2. ok: O clipe abre o menu com Arquivo e Contato (234 ms): `01-menu-do-anexo.png`
3. ok: Contato abre a busca em Meu setor, com os filtros (260 ms): `02-busca.png`
4. ok: A busca em Todos os setores mostra nome, telefone e órgão com o município (452 ms): `03-resultado.png`
5. ok: Escolher o contato pelo teclado mostra a prévia com o indicador de foco (309 ms): `04-previa-foco.png`
6. ok: Voltar devolve a lista com a busca, o filtro e o foco na linha escolhida (166 ms): `05-voltar-lista.png`
7. ok: A linha em foco volta à prévia e Enviar entrega o cartão na conversa (355 ms): `06-enviado.png`
8. ok: Estado final no banco (120 ms)

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
    "contact_cards": "[{\"name\": \"Joana Alves 2\", \"phones\": [{\"phone\": \"5511000000002\", \"wa_id\": null}], \"organization\": \"Prefeitura 281029321 — Campinas\"}]"
  }
]
```
