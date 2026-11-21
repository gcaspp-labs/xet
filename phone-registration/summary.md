# Jornada phone-registration: PASSOU

Commit `b56c4ace6cedfc13879933f392d693910212239b`, início 2026-11-21T06:49:44.324Z, duração 3 s.

### Passos

1. ok: Preparar setor sem número conectado, assunto e contato (879 ms)
2. ok: Atendente entra e abre a janela em Atendimentos (1129 ms): `01-janela-aberta.png`
3. ok: Escolhe o contato e confere órgão e módulo sugeridos (251 ms): `02-contato-orgao-modulo.png`
4. ok: Preenche assunto e resolução pela lista (399 ms): `03-formulario-preenchido.png`
5. ok: Salva e vê o protocolo no aviso (230 ms): `04-protocolo-no-aviso.png`
6. ok: A lista mostra o registro com a marca Telefone (89 ms): `05-linha-na-lista.png`
7. ok: Estado final no banco (114 ms)

### Estado final observado

Número do setor:

```json
{
  "connection_status": "disconnected"
}
```

Chamado criado:

```json
[
  {
    "protocol": "2026-000007",
    "status": "closed",
    "channel": "phone",
    "closure_type": "resolved",
    "sector_id": 6,
    "messages": 0
  }
]
```
