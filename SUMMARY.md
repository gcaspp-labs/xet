# Verificação run-20261111-175843

Commit: f3286563628bb7afb2a994df5a905d83ac57007b. Worktree: clean. Level: journeys.

A jornada `close` falhou por um motivo anterior a este PR: ela não responde à pergunta "Este assunto não está na lista do setor", que entrou com a funcionalidade de Assuntos. O diff do #127 não toca o encerramento nem `scripts/verify/`.

- Commit: `f3286563628bb7afb2a994df5a905d83ac57007b` (branch `ticket/127-orgaos-paginas-e-ordenacao`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-11 17:58:46 -0300
- Resumo gerado em: 2026-11-11 18:00:20 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | FALHOU | 5 | `evidence/close/` |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| organizations-paging (fora do mapa) | PASSOU | 9 | `evidence/organizations-paging/` |

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
- receive-and-assign: [não coberto] Assumir pela lista da tela da conversa, sem mudar de tela (`conversation.spec.ts`).
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
- transfer: [não coberto] Abrir a conversa anterior pelo destino, sem poder agir nela (`transfer-sector.spec.ts`).
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (só testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Sinais do backend

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261111-175843/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 19 arquivo(s) em .verify-app/runs/run-20261111-175843/evidence.

## Detalhe de cada jornada

## Jornada close: FALHOU

Commit `f3286563628bb7afb2a994df5a905d83ac57007b`, início 2026-11-11T20:59:25.079Z, duração 26 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (523 ms)
2. ok: Atendente assume o chamado (353 ms)
3. ok: Formulário vazio não encerra e diz o que falta (370 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (638 ms): `02-contato-sem-cadastro.png`
5. FALHOU: Atendente cadastra o contato pelo próprio formulário (20014 ms)

#### Falha

```text
locator.click: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: 'Encerrar chamado' }).getByRole('button', { name: 'Cadastrar contato' })

    at scripts/verify/journeys/close.mjs:61:68
    at Journey.step (scripts/verify/scripts/journey-lib.mjs:83:27)
    at scripts/verify/journeys/close.mjs:60:11
    at async journey (scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file://scripts/verify/journeys/close.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        6148        3563         682        6750        9273
Swap:           2047         201        1846

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 206676 3648980 193720 6718876    5   20   263   589 5739    5  6  2 91  1  0  0
 0  0 206676 3648320 193720 6719308    0    0     0     0  917 1254  0  0 100  0  0  0
 0  0 206676 3649604 193720 6719308    0    0     0     0  633  910  0  0 100  0  0  0
```

## Jornada organizations-paging: PASSOU

Commit `f3286563628bb7afb2a994df5a905d83ac57007b`, início 2026-11-11T20:59:21.354Z, duração 3 s.

#### Passos

1. ok: Preparar setor e 23 órgãos com o mesmo marcador (651 ms)
2. ok: Buscar abre a página 1 por nome, com 20 órgãos e o total (343 ms): `01-pagina-1-por-nome.png`
3. ok: Próxima mostra os 3 restantes e guarda a página no endereço (206 ms): `02-pagina-2.png`
4. ok: Município ordena crescente e volta à página 1 (171 ms): `03-ordem-por-municipio.png`
5. ok: Clicar de novo inverte a direção (185 ms): `04-municipio-decrescente.png`
6. ok: Página além da última no endereço mostra a última (238 ms): `05-pagina-excedente-vira-ultima.png`
7. ok: Sair para Contatos e voltar conserva busca, página e ordem (246 ms): `06-voltar-conserva-estado.png`
8. ok: O seletor de órgão em Contatos avisa que há mais e o refino acha o 23º (389 ms): `07-seletor-avisa-mais.png`, `08-seletor-refinado.png`
9. ok: Estado final no banco (123 ms)

#### Estado final observado

Órgãos do marcador por município:

```json
[
  {
    "municipio": "Itu",
    "count": 22
  },
  {
    "municipio": "Águas de Lindóia",
    "count": 1
  }
]
```
