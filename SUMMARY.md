# Verificação run-20261114-204644

- Commit: `f316237e7a51070eb02145bb86ea96f338fc800a` (branch `ticket/178-novo-chamado-reorganiza-acoes`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-14 20:46:46 -0300
- Resumo gerado em: 2026-11-14 20:47:54 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| chamados-acoes (fora do mapa) | PASSOU | 10 | `evidence/chamados-acoes/` |

## Fica para a verificação manual ou sem cobertura nestas jornadas

- close: [não coberto] Correção de chamado encerrado (`correction.spec.ts`).
- close: [não coberto] Cancelamento de chamado em atendimento e as permissões do cancelamento (`closing.spec.ts`).
- close: [não coberto] Trocar o órgão só para este chamado, no formulário (`closing.spec.ts`).
- connection: [não coberto] Aparelho que não pôde ser avisado ao desvincular (`connection.spec.ts`).
- connection: [não coberto] Volta da conexão ao reiniciar o serviço (`TestConnectionSurvivesRestart`, só integração).
- connection: [manual] Ler o QR code real com o celular do setor.
- connection: [manual] O QR code real trocando sozinho a cada 20 segundos.
- connection: [manual] O celular mostrando "Central de Atendimento" em vez de "Outro dispositivo".
- connection: [manual] Reiniciar o serviço e ver o número voltar sem novo QR code.
- connection: [manual] Desvincular pelo celular e pela tela, com o aparelho sumindo do celular.
- consult-subjects: [não coberto] Permissão, setor vazio, ausência de resultados e tela estreita (`subjects.spec.ts`).
- conversas-menu: [não coberto] Filtrar e ordenar atendimentos, trocar de chamado e acessar Assuntos (`conversas.spec.ts`).
- conversas-menu: [manual] Receber e responder pelo WhatsApp real.
- receive-and-assign: [não coberto] Assumir pela lista da tela do chamado, sem mudar de tela (`conversation.spec.ts`).
- receive-and-assign: [não coberto] Vários chamados com a mesma pessoa, sem limite (`panel.spec.ts`).
- receive-and-assign: [não coberto] Aviso de queda do tempo real e volta automática (`panel.spec.ts`).
- receive-and-assign: [não coberto] Grupos ignorados e mensagem enviada pelo celular do setor (só testes de integração).
- receive-and-assign: [manual] Mensagem real do WhatsApp chegando ao painel sem recarregar.
- receive-and-assign: [manual] Mensagem real em grupo não aparece; resposta pelo celular do setor aparece no chamado.
- reply: [não coberto] Notas internas, "Falou com" e histórico do contato (`conversation.spec.ts`).
- reply: [não coberto] Áudio gravado, imagens, vídeos e mídias recebidas (`media.spec.ts`).
- reply: [não coberto] Mensagens `pending` marcadas como `failed` ao reiniciar o serviço (só testes de integração).
- reply: [manual] Texto, imagem e PDF chegando ao celular do contato.
- reply: [manual] "Entregue" e "Lida" pelos recibos reais do WhatsApp.
- reply: [manual] Reenvio depois de falha sem duplicar no celular.
- reply: [manual] Áudio gravado chegando como mensagem de voz, com a duração certa.
- transfer: [não coberto] Devolver à fila (`return.spec.ts`).
- transfer: [não coberto] Abrir o chamado anterior pelo destino, sem poder agir nela (`transfer-sector.spec.ts`).
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (só testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Sinais do backend

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261114-204644/logs/backend.log`

## Detalhe de cada jornada

## Jornada chamados-acoes: PASSOU

Commit `f316237e7a51070eb02145bb86ea96f338fc800a`, início 2026-11-14T23:47:32.425Z, duração 7 s.

#### Passos

1. ok: Preparar setor com dois atendentes e um supervisor (678 ms)
2. ok: Meus chamados tem o "+" Novo chamado e o botão do topo saiu (538 ms): `01-meus-chamados-mais.png`, `02-janela-novo-chamado.png`
3. ok: Na fila: Assumir visível, Cancelar chamado só no ⋯ (758 ms): `03-fila-menu.png`
4. ok: Responsável: Encerrar visível; ⋯ com as ações e Cancelar chamado no fim (371 ms): `04-responsavel-cabecalho.png`, `05-responsavel-menu.png`
5. ok: Cancelar chamado abre a janela e volta a /chamados sem chamado aberto (511 ms): `06-cancelar-janela.png`
6. ok: Outro atendente assume o chamado do João (257 ms)
7. ok: Atendente em chamado de outra pessoa: sem ações e sem ⋯ (413 ms): `07-atendente-alheio-sem-acoes.png`
8. ok: Supervisor em chamado de outra pessoa: sem Encerrar nem Outro setor (1134 ms): `08-supervisor-alheio-menu.png`
9. ok: Administrador: cabeçalho com o seletor Setor em uma linha (880 ms): `09-administrador-cabecalho.png`
10. ok: Estado final no banco (132 ms)

#### Estado final observado

Itens do ⋯ na fila:

```json
[
  "Cancelar chamado"
]
```

Altura do cabeçalho (atendente, desktop):

```json
{
  "px": 71.5
}
```

Itens do ⋯ do responsável:

```json
[
  "Devolver à fila",
  "Transferir",
  "Outro setor",
  "Cancelar chamado"
]
```

Itens do ⋯ do supervisor em chamado alheio:

```json
[
  "Devolver à fila",
  "Transferir",
  "Cancelar chamado"
]
```

Altura do cabeçalho (administrador, desktop):

```json
{
  "px": 84
}
```

Chamados do setor:

```json
[
  {
    "name": "Maria Cliente",
    "status": "closed"
  },
  {
    "name": "João Cliente",
    "status": "in_progress"
  }
]
```
