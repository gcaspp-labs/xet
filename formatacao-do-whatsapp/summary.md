# Jornada formatacao-do-whatsapp: PASSOU

Commit `87098f246797e5ca98b43e6beae2a569f8c2e7f8`, início 2026-11-27T16:57:40.451Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado e um cliente com mensagens formatadas (674 ms)
2. ok: Atendente abre o chamado da fila e assume (712 ms)
3. ok: Balão recebido mostra negrito, itálico, riscado e código sem os símbolos (204 ms): `01-recebida-formatada.png`
4. ok: Casos que não formatam e link com "_" continuam como texto e link (184 ms): `02-texto-sem-formatacao-e-link.png`
5. ok: Resposta enviada sai formatada, e o texto guardado mantém os marcadores (394 ms): `03-resposta-formatada.png`
6. ok: Estado final no banco: os marcadores continuam guardados (135 ms)

### Estado final observado

Texto guardado da resposta:

```json
"*Atendente1 660451869:*\nResposta *importante* e _calma_."
```

Chamado verificado:

```json
1
```
