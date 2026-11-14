# Jornada nomes-chamados: PASSOU

Commit `441341552e11cd7471280b3ab039ac207160a5ac`, início 2026-11-14T07:18:52.749Z, duração 3 s.

### Passos

1. ok: Preparar setor, atendente e um contato cadastrado (481 ms)
2. ok: Menu mostra Atendimentos e Chamados (113 ms): `01-menu.png`
3. ok: Tela Chamados tem a lista Meus chamados e o botão Novo chamado (150 ms): `02-tela-chamados.png`
4. ok: Novo chamado: janela, aviso e registro de sistema (834 ms): `03-janela-novo-chamado.png`, `04-aviso-chamado-iniciado.png`, `05-registro-abriu-e-assumiu.png`
5. ok: Breadcrumb e menu levam ao painel Atendimentos (341 ms): `06-painel-atendimentos.png`, `07-meus-chamados-com-item.png`
6. ok: Estado final: só a ação ticket_started no banco, sem código novo (234 ms)

### Estado final observado

Ações de auditoria do chamado:

```json
{
  "acoes": [
    "ticket_started"
  ]
}
```
