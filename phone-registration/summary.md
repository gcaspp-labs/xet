# Jornada phone-registration: PASSOU

Commit `f8ed4ebb2b6a2dd4482b2ff8a9dc7b293144f26c`, início 2026-11-21T07:35:26.511Z, duração 4 s.

### Passos

1. ok: Preparar setor sem número conectado, assunto e contato (521 ms)
2. ok: Atendente entra e abre a janela em Atendimentos (499 ms): `01-janela-aberta.png`
3. ok: Escolhe o contato e confere órgão e módulo sugeridos (337 ms): `02-contato-orgao-modulo.png`
4. ok: Trocar e pedir Novo contato abre um cadastro vazio (543 ms): `03-trocar-novo-contato-vazio.png`
5. ok: Preenche assunto e resolução pela lista (468 ms): `04-formulario-preenchido.png`
6. ok: Salva e vê o protocolo no aviso (227 ms): `05-protocolo-no-aviso.png`
7. ok: A lista mostra o registro com a marca Telefone (121 ms): `06-linha-na-lista.png`
8. ok: Estado final no banco (246 ms)

### Estado final observado

Aviso de sucesso:

```json
"Atendimento registrado · protocolo 2026-000008"
```

Número do setor:

```json
[
  {
    "connection_status": "disconnected"
  }
]
```

Chamado criado:

```json
[
  {
    "protocol": "2026-000008",
    "status": "closed",
    "channel": "phone",
    "closure_type": "resolved",
    "sector_id": 6,
    "messages": 0
  }
]
```
