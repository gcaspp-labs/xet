# Jornada rotas-188: PASSOU

Commit `f4f820adb3afac2e8f561894787545d8fb4ffd86`, início 2026-11-14T16:40:05.053Z, duração 6 s.

### Passos

1. ok: Preparar setor e atendente (414 ms)
2. ok: Chamado ativo abre em /chamados/:id com Chamados ativo (423 ms): `01-chamado-ativo-em-chamados.png`
3. ok: Endereços antigos e desconhecido mostram Não encontrado, sem item ativo (858 ms): `02-antigo-conversas.png`, `03-antigo-conversas-id.png`, `04-antigo-atendimento.png`, `05-desconhecido.png`
4. ok: Ativo em /atendimentos/:id e ids inválidos mostram Não encontrado (921 ms): `06-ativo-em-atendimentos.png`, `07-inexistente-atendimentos.png`, `08-inexistente-chamados.png`, `09-id-invalido-chamados.png`
5. ok: Quem cancela pela própria tela volta a /chamados (1468 ms): `10-depois-de-cancelar.png`
6. ok: Link antigo de chamado encerrado vai para /atendimentos/:id (511 ms): `11-encerrado-em-atendimentos.png`
7. ok: Estado final no banco (114 ms)

### Estado final observado

Chamado da jornada:

```json
{
  "status": "closed",
  "closure_type": "cancelled"
}
```
