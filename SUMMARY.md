# Verificação run-20261104-231655

- Commit: `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f` (branch `task/49-paineis-por-janelas-centrais`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-04 23:16:58 -0300
- Resumo gerado em: 2026-11-04 23:20:40 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| pr71-close-repeat (fora do mapa) | PASSOU | 12 | `evidence/pr71-close-repeat/` |
| pr71-dialogs (fora do mapa) | PASSOU | 21 | `evidence/pr71-dialogs/` |
| pr71-toast (fora do mapa) | PASSOU | 5 | `evidence/pr71-toast/` |
| pr71-toast-hover (fora do mapa) | FALHOU | 5 | `evidence/pr71-toast-hover/` |
| pr71-toast-long (fora do mapa) | PASSOU | 5 | `evidence/pr71-toast-long/` |

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
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-231655/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 45 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-231655/evidence.

## Detalhe de cada jornada

## Jornada pr71-close-repeat: PASSOU

Commit `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f`, início 2026-11-05T02:19:09.127Z, duração 14 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (709 ms)
2. ok: Atendente assume o chamado (371 ms)
3. ok: Formulário vazio não encerra e diz o que falta (2957 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (1067 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (616 ms)
6. ok: Fim antes do início é recusado (3169 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (550 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (135 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (414 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (447 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (941 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (299 ms)

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
  "organization": "Prefeitura 149129656",
  "closed_by": "Atendente1 149128939",
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
    "actor": "Atendente1 149128939"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 149128939"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 149128939"
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

## Jornada pr71-dialogs: PASSOU

Commit `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f`, início 2026-11-05T02:17:09.146Z, duração 31 s.

#### Passos

1. ok: Preparar setor, módulo, órgão e contato fictícios (700 ms)
2. ok: Assumir chamado pela tela (517 ms)
3. ok: Encerrar chamado: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (3171 ms): `01-encerrar-chamado.png`
4. ok: Transferir para outro setor: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (722 ms): `02-transferir-para-outro-setor.png`
5. ok: Cancelar chamado: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (585 ms): `03-cancelar-chamado.png`
6. ok: Devolver à fila: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (560 ms): `04-devolver-à-fila.png`
7. ok: Transferir preserva a escolha do seletor (817 ms): `05-transferir-chamado.png`
8. ok: Cadastro pelo atendimento tem bloqueio e preserva nome (410 ms): `06-cadastrar-contato.png`
9. ok: Cadastro aninhado: Cancelar devolve assunto e resolução; Esc não fecha a origem (835 ms): `07-cadastro-aninhado-bloqueado.png`
10. ok: Combobox seleciona órgão e Esc fecha só a lista (959 ms)
11. ok: Formulário longo em 480px: corpo rola; título e rodapé ficam (732 ms): `08-corpo-com-rolagem-rodape-fixo.png`
12. ok: Nova conversa e cadastro aninhado preservam a busca ao cancelar (1092 ms): `09-novo-contato.png`
13. ok: Contatos e importação fecham por X, Esc e clique fora (2295 ms)
14. ok: Módulos e desvincular número têm fechamento normal (2334 ms)
15. ok: Usuários, setores e órgãos têm fechamento normal (4100 ms)
16. ok: Curto, longo e aninhado; light; desktop; texto Maior sem rolagem horizontal (2013 ms): `10-curto-light-desktop-maior.png`, `11-longo-light-desktop-maior.png`, `12-aninhado-light-desktop-maior.png`
17. ok: Curto, longo e aninhado; light; celular; texto Maior sem rolagem horizontal (1765 ms): `13-curto-light-celular-maior.png`, `14-longo-light-celular-maior.png`, `15-aninhado-light-celular-maior.png`
18. ok: Curto, longo e aninhado; dark; desktop; texto Maior sem rolagem horizontal (1796 ms): `16-curto-dark-desktop-maior.png`, `17-longo-dark-desktop-maior.png`, `18-aninhado-dark-desktop-maior.png`
19. ok: Curto, longo e aninhado; dark; celular; texto Maior sem rolagem horizontal (1554 ms): `19-curto-dark-celular-maior.png`, `20-longo-dark-celular-maior.png`, `21-aninhado-dark-celular-maior.png`
20. ok: Menu móvel continua gaveta; Esc fecha (856 ms): `22-menu-gaveta-celular.png`
21. ok: Estado final no banco: formulários cancelados não alteraram chamado nem contato (162 ms)

#### Estado final observado

Estado final:

```json
{
  "status": "in_progress",
  "registered": false,
  "subject": null,
  "resolution": null
}
```

## Jornada pr71-toast: PASSOU

Commit `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f`, início 2026-11-05T02:18:21.192Z, duração 7 s.

#### Passos

1. ok: Preparar chamado fictício com módulo e órgão (675 ms)
2. ok: Assumir e preencher o encerramento pela tela (920 ms)
3. ok: Cadastrar o contato dentro do encerramento e voltar ao formulário preenchido (794 ms)
4. ok: Estado no banco antes de encerrar: contato cadastrado e chamado em atendimento (141 ms)
5. ok: Botão Encerrar continua utilizável depois de salvar o contato (2961 ms): `01-antes-de-clicar-encerrar.png`

#### Estado final observado

Estado antes da ação:

```json
{
  "status": "in_progress",
  "registered": true
}
```

Estado final:

```json
[
  {
    "status": "closed"
  }
]
```

## Jornada pr71-toast-hover: FALHOU

Commit `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f`, início 2026-11-05T02:19:51.968Z, duração 16 s.

#### Passos

1. ok: Preparar chamado fictício com módulo e órgão (683 ms)
2. ok: Assumir e preencher o encerramento pela tela (3461 ms)
3. ok: Cadastrar o contato dentro do encerramento e voltar ao formulário preenchido (604 ms)
4. ok: Estado no banco antes de encerrar: contato cadastrado e chamado em atendimento (148 ms)
5. FALHOU: Botão Encerrar continua utilizável depois de salvar o contato (7488 ms): `01-cursor-sobre-o-botao-encerrar.png`, `02-aviso-ainda-bloqueia-apos-sete-segundos.png`

#### Falha

```text
locator.click: Timeout 7000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: 'Encerrar chamado', exact: true }).getByRole('button', { name: 'Encerrar', exact: true })
    - locator resolved to <button tabindex="0" type="submit" form="_r_12_" data-slot="button" class="group/button inline-flex shrink-0 cursor-pointer items-center justify-center border font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px] border-primary bg-primary text-primary-foreground hover:border-accent-strong hover:bg-accent-strong gap-[7px] rounded-(--radius-8) px-3.5 py-2 text-[ca…>Encerrar</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <li tabindex="0" data-index="0" data-front="true" data-styled="true" data-mounted="true" data-swiped="false" data-visible="true" data-type="success" data-sonner-toast="" data-promise="false" data-removed="false" data-swiping="false" data-expanded="true" data-swipe-out="false" data-dismissible="true" data-y-position="bottom" data-x-position="center" class="cn-toast body text-[calc(13px*var(--text-scale))]!">…</li> from <div id="root" data-base-ui-inert="">…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <li tabindex="0" data-index="0" data-front="true" data-styled="true" data-mounted="true" data-swiped="false" data-visible="true" data-type="success" data-sonner-toast="" data-promise="false" data-removed="false" data-swiping="false" data-expanded="true" data-swipe-out="false" data-dismissible="true" data-y-position="bottom" data-x-position="center" class="cn-toast body text-[calc(13px*var(--text-scale))]!">…</li> from <div id="root" data-base-ui-inert="">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    13 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <li tabindex="0" data-index="0" data-front="true" data-styled="true" data-mounted="true" data-swiped="false" data-visible="true" data-type="success" data-sonner-toast="" data-promise="false" data-removed="false" data-swiping="false" data-expanded="true" data-swipe-out="false" data-dismissible="true" data-y-position="bottom" data-x-position="center" class="cn-toast body text-[calc(13px*var(--text-scale))]!">…</li> from <div id="root" data-base-ui-inert="">…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

    at /tmp/xet-revisor-pr71-toast-hover.mjs:47:64
    at async Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:21)
    at async file:///tmp/xet-revisor-pr71-toast-hover.mjs:42:3
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///tmp/xet-revisor-pr71-toast-hover.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        9404        2441        1669        5579        6017
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 5  0 2096732 2499920  82176 5631380   27  107   592   883 7086    5 10  2 88  0  0  0
 0  0 2096732 2497280  82176 5631440    0    0     0     0 7814 7828 10  2 88  0  0  0
 1  0 2096732 2496568  82176 5631392    0    0     0     0 8721 8157 11  2 87  0  0  0
```

#### Estado final observado

Estado antes da ação:

```json
{
  "status": "in_progress",
  "registered": true
}
```

Elemento que recebe o clique no centro do botão:

```json
{
  "button": {
    "x": 767,
    "y": 731.4375,
    "width": 82,
    "height": 36.5625
  },
  "hit": "<li tabindex=\"0\" class=\"cn-toast body text-[calc(13px*var(--text-scale))]!\" data-sonner-toast=\"\" data-styled=\"true\" data-mounted=\"true\" data-promise=\"false\" data-swiped=\"false\" data-removed=\"false\" data-visible=\"true\" data-y-position=\"bottom\" data-x-position=\"center\" data-index=\"0\" data-front=\"true\" data-swiping=\"false\" data-dismissible=\"true\" data-type=\"success\" data-swipe-out=\"false\" data-expanded=\"true\" style=\"--index: 0; --toasts-before: 0; --z-index: 1; --offset: 0px; --initial-height: 53.5px;\"><div data-icon=\"\" class=\"\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-circle-check lucide-check-circle-2 size-4 text-success\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m16 9-5.5 5.5L8 12\"></path></svg></div><div data-content=\"\" class=\"\"><div data-title=\"\" class=\"\">Contato salvo</div></div></li>",
  "toast": "<li tabindex=\"0\" class=\"cn-toast body text-[calc(13px*var(--text-scale))]!\" data-sonner-toast=\"\" data-styled=\"true\" data-mounted=\"true\" data-promise=\"false\" data-swiped=\"false\" data-removed=\"false\" data-visible=\"true\" data-y-position=\"bottom\" data-x-position=\"center\" data-index=\"0\" data-front=\"true\" data-swiping=\"false\" data-dismissible=\"true\" data-type=\"success\" data-swipe-out=\"false\" data-expanded=\"true\" style=\"--index: 0; --toasts-before: 0; --z-index: 1; --offset: 0px; --initial-height: 53.5px;\"><div data-icon=\"\" class=\"\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-circle-check lucide-check-circle-2 size-4 text-success\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m16 9-5.5 5.5L8 12\"></path></svg></div><div data-content=\"\" class=\"\"><div data-title=\"\" class=\"\">Contato salvo</div></div></li>"
}
```

Estado final no banco após a tentativa:

```json
[
  {
    "status": "in_progress"
  }
]
```

## Jornada pr71-toast-long: PASSOU

Commit `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f`, início 2026-11-05T02:18:47.053Z, duração 9 s.

#### Passos

1. ok: Preparar chamado fictício com módulo e órgão (721 ms)
2. ok: Assumir e preencher o encerramento pela tela (3197 ms)
3. ok: Cadastrar o contato dentro do encerramento e voltar ao formulário preenchido (708 ms)
4. ok: Estado no banco antes de encerrar: contato cadastrado e chamado em atendimento (152 ms)
5. ok: Botão Encerrar continua utilizável depois de salvar o contato (2961 ms): `01-antes-de-clicar-encerrar.png`

#### Estado final observado

Estado antes da ação:

```json
{
  "status": "in_progress",
  "registered": true
}
```

Estado final:

```json
[
  {
    "status": "closed"
  }
]
```
