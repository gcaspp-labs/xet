# Verificação run-20261105-143158

- Commit: `f34f7a1d10c434a993bea12625a7d65db1fe7b9c` (branch `task/89-email-do-setor`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-05 14:32:00 -0300
- Resumo gerado em: 2026-11-05 14:32:29 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| email-do-setor (fora do mapa) | PASSOU | 13 | `evidence/email-do-setor/` |

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
- Log: `.verify-app/runs/run-20261105-143158/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 11 arquivo(s) em .verify-app/runs/run-20261105-143158/evidence.

## Detalhe de cada jornada

## Jornada email-do-setor: PASSOU

Commit `f34f7a1d10c434a993bea12625a7d65db1fe7b9c`, início 2026-11-05T17:32:09.896Z, duração 9 s.

#### Passos

1. ok: Preparar um setor, porque o banco da execução começa vazio (245 ms)
2. ok: Abrir a tela de setores (154 ms)
3. ok: Cadastro recusa formato inválido (335 ms): `01-formato-invalido.png`
4. ok: Cadastro grava o e-mail e a tabela mostra (455 ms)
5. ok: Setor sem e-mail mostra travessão (521 ms)
6. ok: Repetido com outras maiúsculas é recusado (343 ms): `02-email-repetido.png`
7. ok: Edição troca e limpa (1186 ms)
8. ok: Preparar um e-mail longo para as capturas (516 ms)
9. ok: Tema light, desktop, texto Maior (1064 ms): `03-tabela-light-desktop.png`, `04-formulario-light-desktop.png`
10. ok: Tema light, celular, texto Maior (988 ms): `05-tabela-light-celular.png`, `06-formulario-light-celular.png`
11. ok: Tema dark, desktop, texto Maior (1025 ms): `07-tabela-dark-desktop.png`, `08-formulario-dark-desktop.png`
12. ok: Tema dark, celular, texto Maior (891 ms): `09-tabela-dark-celular.png`, `10-formulario-dark-celular.png`
13. ok: Estado final no banco (233 ms)

#### Estado final observado

Setores da jornada:

```json
[
  {
    "name": "Financeiro mw3tp8o5",
    "email": "atendimento.financeiro.mw3tp8o5@prefeitura-exemplo.test"
  },
  {
    "name": "Sem e-mail mw3tp8o5",
    "email": null
  }
]
```

Auditoria:

```json
[
  {
    "action": "sector_created",
    "email": {
      "to": "financeiro.mw3tp8o5@exemplo.test",
      "from": null
    }
  },
  {
    "action": "sector_updated",
    "email": {
      "to": "contas.mw3tp8o5@exemplo.test",
      "from": "financeiro.mw3tp8o5@exemplo.test"
    }
  },
  {
    "action": "sector_updated",
    "email": {
      "to": null,
      "from": "contas.mw3tp8o5@exemplo.test"
    }
  },
  {
    "action": "sector_updated",
    "email": {
      "to": "atendimento.financeiro.mw3tp8o5@prefeitura-exemplo.test",
      "from": null
    }
  }
]
```
