# Mesclar um atendimento encerrado num chamado pendente

O atendente encerra o chamado novo (B) e, já em **Atendimentos**, usa **Mesclar em pendente** para juntá-lo ao chamado que tinha ficado pendente (A): o pendente herda a situação e os dados do encerramento, recebe as mensagens dos dois e volta para o histórico como encerrado; B fica Mesclado (spec #332, #341, #343).

## Sub-features

- [jornada] O responsável coloca o chamado A como pendente pelo menu ⋯, com motivo obrigatório; A sai da Fila e fica na aba Pendentes.
- [jornada] O cliente volta a escrever e abre o chamado B na Fila; o atendente assume e encerra B pelo formulário, com assunto, resolução, módulo e órgão.
- [jornada] Em Atendimentos, a ficha do encerrado traz **Mesclar em pendente** ao lado do Corrigir, como ação secundária (protótipo versão A da #343).
- [jornada] A janela Mesclar em pendente explica a troca e lista os pendentes do contato no setor, com protocolo, motivo, quem marcou e há quanto tempo; o primeiro vem escolhido e não há campo de motivo.
- [jornada] Confirmada, A abre em `/atendimentos/<A>` como Encerrado, com o assunto, a resolução, o órgão e quem encerrou de B, as mensagens de A e de B na ordem do tempo e o registro "<quem> mesclou o atendimento <protocolo de B> neste chamado".
- [jornada] B aparece em Atendimentos como Mesclado, com o link "Ver chamado <protocolo de A>", e A não está mais na aba Pendentes.
- [jornada] No banco: A `closed`/`resolved` com os dados de B e as 2 mensagens, B `closed`/`merged` com `merged_into_ticket_id` = A e nenhuma mensagem; a auditoria traz `ticket_pending` em A, `ticket_closed` e `ticket_merged` em B e `ticket_closed_by_merge` em A (com `merged_protocol` de B e sem motivo).
- [não coberto] O atendimento cancelado também mescla, herdando o motivo do cancelamento no registro de A: fica nos testes de `frontend/e2e/mesclar-em-pendente.spec.ts`.
- [não coberto] A corrida de alguém retomar o pendente escolhido antes da mesclagem, e as recusas (transferido, já mesclado, sem permissão de correção, sem pendente do contato): também nos testes de `frontend/e2e/mesclar-em-pendente.spec.ts` e nos testes do backend.

## How to get to it

1. Entre como atendente do setor, assuma um chamado da Fila e escolha **Colocar como pendente** no menu ⋯, com o motivo.
2. O cliente volta a escrever: o chamado novo entra na Fila. Assuma-o e encerre-o pelo botão **Encerrar**, com assunto e resolução.
3. Em **Atendimentos**, busque o protocolo do encerrado, abra a ficha e use **Mesclar em pendente**, ao lado do Corrigir.
4. O pendente escolhido abre em Atendimentos como encerrado, com os dados e as mensagens dos dois; o encerrado aparece como **Mesclado**, com o link para ele.

## Driving it

```bash
scripts/verify/scripts/drive.sh mesclar-encerrado-em-pendente
```

- O contato é cadastrado num órgão pela API do administrador antes de tudo: o encerramento exige o cadastro, e isso é preparação, não o que se prova.
- O pendente A é criado pela tela (assumir, menu ⋯, janela); o chamado novo B nasce do `t.phone(setor).receive(...)` com o mesmo contato. O id de A vem do endereço depois de assumir, e o de B do `t.sql`, porque a entrega devolve o id da mensagem.
- O encerramento é o da tela (formulário Encerrar); o assunto é novo no setor, então a janela pergunta se entra na lista e a jornada responde **Não adicionar**, como em `close`.
- Na lista de Atendimentos, o protocolo é um link sobre a linha inteira: clicar nele abre a ficha.
- A posição das mensagens e do aviso da mesclagem é conferida por `boundingBox().y`, como nos testes de tela.

## Gotchas

- O endereço `/chamados/<id>` de um chamado encerrado redireciona para `/atendimentos/<id>` (`lib/tickets.ts`, `ticketPath`); por isso B e A só aparecem nas telas de Atendimentos depois do encerramento e da mesclagem.
- A ação só aparece para quem pode corrigir B (quem encerrou, supervisor ou administrador) **e** quando há pendente do mesmo contato no setor; sem isso, a ficha mantém só o Corrigir.
- A janela não pede motivo: o registro de A herda o motivo de B apenas quando B foi cancelado; num encerrado, a linha "Motivo:" não existe.
- O aviso da mesclagem fica no ponto da mesclagem, depois das mensagens que B trouxe para A, e é um `listitem` com o nome acessível "Registro do chamado".
- A aba Pendentes vazia diz "Nenhum chamado pendente"; a aba fechada não entra na árvore de acessibilidade, e por isso a lista vazia é procurada no painel depois de abrir a aba.

## Estado final observável

- **Tela:** a janela Mesclar em pendente com o pendente escolhido; a ficha de A encerrada com os dados de B, as mensagens dos dois na ordem do tempo e o registro da mesclagem; a lista de Atendimentos com B como Mesclado e o link para A; a aba Pendentes vazia.
- **`tickets`:** A `closed`/`resolved` com assunto, resolução, órgão e quem encerrou de B, sem `merged_into_ticket_id`, com as 2 mensagens; B `closed`/`merged` com `merged_into_ticket_id` = A e nenhuma mensagem.
- **`audit_logs`:** em A, `ticket_pending` e `ticket_closed_by_merge` (com `merged_protocol` de B e `reason` nulo); em B, `ticket_closed` e `ticket_merged` (com `merged_into_ticket_id` = A e os ids das mensagens movidas).
