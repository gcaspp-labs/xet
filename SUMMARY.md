# Verificação run-20261113-140149

Commit: 184779510eac2cf4b43bbdd2089ebb611ac02daf

- Commit: `184779510eac2cf4b43bbdd2089ebb611ac02daf` (branch `ticket/163-menu-tela-inicial-perfil`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-13 14:01:51 -0300
- Resumo gerado em: 2026-11-13 14:03:34 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Flows

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | PASSOU | 4 | `evidence/conversas-menu/` |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| menu-perfis (fora do mapa) | PASSOU | 5 | `evidence/menu-perfis/` |

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
- conversas-menu: [não coberto] Filtrar e ordenar atendimentos, trocar de conversa e acessar Assuntos (`conversas.spec.ts`).
- conversas-menu: [manual] Receber e responder pelo WhatsApp real.
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

- Linhas de erro no log do backend: 3, sendo 3 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261113-140149/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 15 arquivo(s) em .verify-app/runs/run-20261113-140149/evidence.

## Detalhe de cada jornada

## Jornada conversas-menu: PASSOU

Commit `184779510eac2cf4b43bbdd2089ebb611ac02daf`, início 2026-11-13T17:03:24.103Z, duração 3 s.

#### Passos

1. ok: Preparar setor e atendente (412 ms)
2. ok: Abrir Conversas pelo menu (201 ms): `01-conversas-vazia.png`
3. ok: Abrir uma conversa e conferir os temas (1584 ms): `02-fila-com-chamado.png`, `03-conversa-claro.png`, `04-conversa-escuro.png`, `05-conversa-alto-contraste.png`
4. ok: Estado final do setor (113 ms)

#### Estado final observado

Chamados em atendimento no setor:

```json
{
  "quantidade": 1
}
```

## Jornada menu-perfis: PASSOU

Commit `184779510eac2cf4b43bbdd2089ebb611ac02daf`, início 2026-11-13T17:03:13.537Z, duração 4 s.

#### Passos

1. ok: Preparar setor e pessoas (380 ms)
2. ok: Entrada e menu: administrador (1277 ms): `01-administrador-inicio.png`, `02-administrador-atendimento.png`
3. ok: Entrada e menu: supervisor (1101 ms): `03-supervisor-inicio.png`, `04-supervisor-atendimento.png`
4. ok: Entrada e menu: atendente (1121 ms): `05-atendente-inicio.png`, `06-atendente-atendimento.png`
5. ok: Estado final dos perfis preparados (118 ms)

#### Estado final observado

Perfis do setor de teste:

```json
[
  {
    "role": "agent"
  },
  {
    "role": "supervisor"
  }
]
```

## Comparação com o protótipo aprovado da #109

Dashboard fica acima de Helpdesk, sem rótulo de grupo, e o topo mostra somente o setor; atendente não vê Dashboard. As capturas atuais incluem Conversas no menu, incorporada depois do protótipo. A tela inicial do atendente é Conversas conforme a decisão posterior da #159. Os dados e o setor nas imagens são fictícios.
