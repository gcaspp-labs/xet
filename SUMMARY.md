# Verificação run-20261105-075243

- Commit: `27f483034078a4d4419e2a251efa3ac176466587` (branch `task/49-paineis-por-janelas-centrais`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-05 07:52:44 -0300
- Resumo gerado em: 2026-11-05 07:54:43 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | PASSOU | 12 | `evidence/close/` |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| pr71-link-and-keyboard (fora do mapa) | PASSOU | 7 | `evidence/pr71-link-and-keyboard/` |

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
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261105-075243/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 15 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261105-075243/evidence.

## Detalhe de cada jornada

## Jornada close: PASSOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:54:10.639Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (315 ms)
2. ok: Atendente assume o chamado (217 ms)
3. ok: Formulário vazio não encerra e diz o que falta (282 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (567 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (442 ms)
6. ok: Fim antes do início é recusado (91 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (282 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (73 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (244 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (198 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (549 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (124 ms)

#### Estado final observado

Chamado cancelado:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "action": "ticket_cancelled",
  "reason": "Golpe do falso boleto.",
  "contact_registered": false
}
```

Chamado encerrado:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Contracheque",
  "resolution": "Enviada a segunda via.",
  "organization": "Prefeitura 050641967",
  "closed_by": "Atendente1 050640916",
  "has_closed_at": true,
  "end_after_start": true,
  "modules": "Folha, Patrimônio"
}
```

Auditoria do encerramento:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 050640916"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 050640916"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 050640916"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 5,
  "status": "queued"
}
```

## Jornada pr71-link-and-keyboard: PASSOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:52:55.879Z, duração 9 s.

#### Passos

1. ok: Preparar três chamados fictícios (335 ms)
2. ok: Assumir o chamado atual e aguardar o aviso anterior terminar (3028 ms)
3. ok: Link oculto sobre Encerrar deixa o clique passar e preserva o chamado e o rascunho (712 ms): `01-link-oculto-aviso-sobre-encerrar.png`
4. ok: Aviso termina mesmo com o cursor parado sobre o botão (2641 ms): `02-mesmo-chamado-mesmo-assunto.png`
5. ok: Com outro aviso ativo, Tab e Shift+Tab ficam na janela e nunca no link oculto (663 ms)
6. ok: Cancelar restaura o link ainda ativo, que abre o destino correto (449 ms): `03-link-restaurado-destino-correto.png`
7. ok: Estado final no banco: três em atendimento, sem encerramento ou troca de responsável (65 ms)

#### Estado final observado

Clique sob o local do link:

```json
{
  "position": {
    "x": 17,
    "y": 22.781631469726562
  },
  "forcado": false,
  "esperaParaSumir": false
}
```

16 movimentos de teclado:

```json
[
  {
    "inDialog": true,
    "toast": false,
    "tag": "TEXTAREA"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "SPAN"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  }
]
```

Chamados fictícios:

```json
[
  {
    "id": 1,
    "status": "in_progress",
    "assignee_id": 3,
    "subject": null,
    "name": "Atual T49"
  },
  {
    "id": 2,
    "status": "in_progress",
    "assignee_id": 3,
    "subject": null,
    "name": "Destino Mouse T49"
  },
  {
    "id": 3,
    "status": "in_progress",
    "assignee_id": 3,
    "subject": null,
    "name": "Destino Teclado T49"
  }
]
```
