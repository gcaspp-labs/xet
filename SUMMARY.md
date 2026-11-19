# Verificação run-20261119-072758

- Commit: `f5b748d36c19db05e81b390272e9366b6be6d826` (branch `ticket/259-usuario-trocar-propria-senha`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-19 07:28:00 -0300
- Resumo gerado em: 2026-11-19 07:28:44 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.


Commit: f5b748d36c19db05e81b390272e9366b6be6d826.

## Comparação com o design (#259, protótipo aprovado)

- Menu, vazio, senha atual incorreta, política, comum, longa, confirmação diferente, igual à atual e sucesso: mesmos textos, mesma ordem dos campos, erros embaixo de cada campo e a dica da regra embaixo de "Nova senha", substituída pelo erro. Item "Alterar senha" com ícone de chave, logo antes de "Sair".
- "Enviando" não foi capturado: é o estado padrão do FormDialog (campos e ação primária desabilitados), igual ao das outras janelas.
- Tema escuro não capturado nesta jornada; a tela usa só tokens, como as demais.
- A jornada `change-own-password` é provisória, só deste PR (o ticket não pede jornada nova).

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-closed-tickets | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | PASSOU | 4 | `evidence/conversas-menu/` |
| final-routes | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| change-own-password (fora do mapa) | PASSOU | 12 | `evidence/change-own-password/` |

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
- consult-closed-tickets: [não coberto] Paginação, ordem pelas demais colunas e correção do atendimento na ficha (`atendimentos.spec.ts`, `correction.spec.ts`).
- consult-closed-tickets: [não coberto] Abas Detalhes e Histórico da ficha e o chamado anterior de uma transferência (`ficha-atendimento.spec.ts`; o chamado anterior também está em `transfer`).
- consult-subjects: [não coberto] Permissão, setor vazio, ausência de resultados e tela estreita (`subjects.spec.ts`).
- conversas-menu: [não coberto] Listar só os chamados próprios, ordenar por atividade e trocar de chamado (`conversas.spec.ts`).
- conversas-menu: [manual] Receber e responder pelo WhatsApp real.
- final-routes: [não coberto] `/atendimentos/<id>` de chamado ativo, sem acesso (403), e o item do menu ativo em cada caso (`rotas.spec.ts`).
- final-routes: [não coberto] Endereços desconhecidos sem sessão, que vão para o login (`rotas.spec.ts`).
- receive-and-assign: [não coberto] Assumir pela lista da tela do chamado, sem mudar de tela (`conversation.spec.ts`).
- receive-and-assign: [não coberto] Vários chamados com a mesma pessoa, sem limite (`conversas.spec.ts`).
- receive-and-assign: [não coberto] Aviso de queda do tempo real e volta automática (`conversas.spec.ts`).
- receive-and-assign: [não coberto] Grupos ignorados e mensagem enviada pelo celular do setor (só testes de integração).
- receive-and-assign: [manual] Mensagem real do WhatsApp chegando à fila de Chamados sem recarregar.
- receive-and-assign: [manual] Mensagem real em grupo não aparece; resposta pelo celular do setor aparece no chamado.
- reply: [não coberto] Histórico dos chamados do contato, na ficha do atendimento (`ficha-atendimento.spec.ts`).
- reply: [não coberto] Áudio gravado, imagens, vídeos e mídias recebidas (`media.spec.ts`).
- reply: [não coberto] Mensagens `pending` marcadas como `failed` ao reiniciar o serviço (só testes de integração).
- reply: [manual] Texto, imagem e PDF chegando ao celular do contato.
- reply: [manual] "Entregue" e "Lida" pelos recibos reais do WhatsApp.
- reply: [manual] Reenvio depois de falha sem duplicar no celular.
- reply: [manual] Áudio gravado chegando como mensagem de voz, com a duração certa.
- transfer: [não coberto] Devolver à fila (`return.spec.ts`).
- transfer: [não coberto] Abrir o chamado anterior pelo destino, sem poder agir nela (`transfer-sector.spec.ts`).
- transfer: [não coberto] Contato com órgão principal: o chamado chega ao destino com esse órgão (regra 14; `TestSectorTransferTakesTheMainOrganizationOfTheContact`).
- transfer: [não coberto] Transferência sem motivo e quadro de origem de uma transferência antiga, com assunto e resolução (`transfer-sector.spec.ts`).
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (`transfer-sector.spec.ts` e testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Sinais do backend

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261119-072758/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 18 arquivo(s) em .verify-app/runs/run-20261119-072758/evidence.

## Detalhe de cada jornada

## Jornada change-own-password: PASSOU

Commit `f5b748d36c19db05e81b390272e9366b6be6d826`, início 2026-11-19T10:28:12.197Z, duração 6 s.

#### Passos

1. ok: Preparar setor e atendente com senha conhecida (464 ms)
2. ok: Menu Configurações mostra "Alterar senha" antes de "Sair" (236 ms): `01-menu.png`
3. ok: Diálogo vazio com a dica da regra embaixo de "Nova senha" (190 ms): `02-vazio.png`
4. ok: Atual vazia e confirmação diferente: erro no formulário, sem chamar a API (271 ms): `03-confirmacao.png`
5. ok: Senha atual incorreta: erro em "Senha atual" (375 ms): `04-atual-incorreta.png`
6. ok: Regra da senha: mensagem da redefinição em "Nova senha" (223 ms): `05-politica.png`
7. ok: Senha comum: recusada pelo servidor em "Nova senha" (330 ms): `06-comum.png`
8. ok: Longa demais: recusada em "Nova senha" (209 ms): `07-longa.png`
9. ok: Nova igual à atual: recusada em "Nova senha" (315 ms): `08-igual.png`
10. ok: Sucesso: diálogo fecha e aparece "Senha alterada" (1047 ms): `09-sucesso.png`
11. ok: Esta sessão continua; a outra sessão do usuário cai (478 ms): `10-sessao-atual.png`, `11-outra-sessao.png`
12. ok: Estado final no banco (247 ms)

#### Estado final observado

Sessões do atendente:

```json
{
  "quantidade": 1
}
```

Auditoria do atendente:

```json
[
  {
    "action": "user_created",
    "actor_id": 1
  },
  {
    "action": "user_password_reset",
    "actor_id": 1
  },
  {
    "action": "user_password_changed",
    "actor_id": 3
  }
]
```

## Jornada conversas-menu: PASSOU

Commit `f5b748d36c19db05e81b390272e9366b6be6d826`, início 2026-11-19T10:28:21.582Z, duração 3 s.

#### Passos

1. ok: Preparar setor e atendente (406 ms)
2. ok: Abrir Chamados pelo menu (196 ms): `01-conversas-vazia.png`
3. ok: Abrir um chamado e conferir os temas (1669 ms): `02-fila-com-chamado.png`, `03-conversa-claro.png`, `04-conversa-escuro.png`, `05-conversa-alto-contraste.png`
4. ok: Estado final do setor (111 ms)

#### Estado final observado

Chamados em atendimento no setor:

```json
{
  "quantidade": 1
}
```
