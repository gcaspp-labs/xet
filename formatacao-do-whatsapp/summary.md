# Jornada formatacao-do-whatsapp: PASSOU

Commit `7628aee8baba65a9b973a66a0d318e9508febb4f`, início 2026-11-27T17:18:46.113Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado e um cliente com mensagens formatadas (712 ms)
2. ok: Atendente abre o chamado da fila e assume (697 ms)
3. ok: Balão recebido mostra negrito, itálico, riscado e código sem os símbolos (228 ms): `01-recebida-formatada.png`
4. ok: Casos que não formatam e link com "_" continuam como texto e link (246 ms): `02-texto-sem-formatacao-e-link.png`
5. ok: Resposta enviada sai formatada, e o texto guardado mantém os marcadores (397 ms): `03-resposta-formatada.png`
6. ok: Estado final no banco: os marcadores continuam guardados (122 ms)

### Estado final observado

Texto guardado da resposta:

```json
"*Atendente1 926114594:*\nResposta *importante* e _calma_."
```

Chamado verificado:

```json
1
```
