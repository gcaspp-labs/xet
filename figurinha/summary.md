# Jornada figurinha: PASSOU

Commit `e3c308e22a44369fbffbbd295d14620e3ebe753b`, início 2026-11-27T15:35:19.807Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado, atendente e um chamado na fila com uma figurinha (483 ms)
2. ok: A prévia da fila mostra "Figurinha" (307 ms): `01-previa-fila.png`
3. ok: Abrir o chamado da fila pelo endereço (451 ms)
4. ok: A figurinha aparece como imagem pequena, sem o aviso de não suportada (204 ms): `02-figurinha-na-conversa.png`
5. ok: Reagir à figurinha mostra a reação embaixo dela (543 ms): `03-reacao-na-figurinha.png`
6. ok: Responder cita a figurinha como "🖼️ Figurinha" (486 ms): `04-citacao-em-preparo.png`, `05-resposta-citando-figurinha.png`
7. ok: Estado final no banco: tipo, arquivo, citação e reação (482 ms)

### Estado final observado

Figurinha gravada:

```json
{
  "tipo": "sticker",
  "mime": "image/webp",
  "citacao": "sticker",
  "reacao": "👍"
}
```
