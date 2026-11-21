# Jornada send-contact: PASSOU

Commit `2c57e5fba1c84f7fffcf617e3b9a766c1960ee54`, início 2026-11-21T14:56:58.148Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado, atendente e um contato cadastrado no órgão (865 ms)
2. ok: O clipe abre o menu com Arquivo e Contato (281 ms): `01-menu-do-anexo.png`
3. ok: Contato abre a busca em Meu setor, com os filtros (270 ms): `02-busca.png`
4. ok: A busca mostra nome, telefone e órgão com o município (162 ms): `03-resultado.png`
5. ok: Escolher o contato mostra a prévia do cartão (229 ms): `04-previa.png`
6. ok: Enviar fecha a janela e o cartão entra na conversa com a situação de entrega (366 ms): `05-enviado.png`
7. ok: Estado final no banco (120 ms)

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
    "contact_cards": "[{\"name\": \"Joana Alves 2\", \"phones\": [{\"phone\": \"5511000000002\", \"wa_id\": null}], \"organization\": \"Prefeitura 018150736 — Campinas\"}]"
  }
]
```
