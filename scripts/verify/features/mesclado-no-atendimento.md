# Chamado mesclado em Atendimentos

O chamado que foi mesclado num pendente (spec #332, "Mesclar em pendente") deixa de ser um atendimento normal: as mensagens foram para o original, e ele passa a existir só como registro, com a situação **Mesclado** e o caminho de volta para o original.

Regras de negócio em `docs/features/queue.md`, regras 28 a 32.

## Sub-features

### [jornada] Atendimentos lista o mesclado com a situação Mesclado

Na lista de Atendimentos, o mesclado aparece como os demais atendimentos, com a situação **Mesclado** no lugar de Encerrado e, abaixo dela, o link **"Ver chamado \<protocolo do original\>"**.

- O link fica por cima do clique da linha: abre o original, não a ficha do mesclado.
- O original pendente abre em `/chamados/:id`; já encerrado, em `/atendimentos/:id` (`docs/features/queue.md`, regras 28 a 30). A jornada percorre o original já encerrado, que é o resultado de mesclar um encerrado num pendente; o original pendente (Retomar chamado) está em `atendimentos.spec.ts`.
- A coluna Situação ordena o mesclado pelo próprio nome, "mesclado", e não junto dos encerrados.

### [jornada] A ficha do mesclado só avisa a mesclagem

Em `/atendimentos/:id` de um mesclado, no lugar da conversa aparece o aviso "Chamado mesclado — as mensagens deste chamado foram para o chamado original", com o link para o original e o rodapé "Mesclado por … em …".

- Sem campo de mensagem, sem Corrigir e sem a conversa: as mensagens estão no original.
- A aba Detalhes mostra a situação Mesclado.

### [jornada] O histórico do contato e do órgão mostra Mesclado

As abas Histórico de contatos e de órgãos usam a mesma etiqueta de situação, então o mesclado aparece lá como Mesclado.

## O que esta jornada não prova

- O WhatsApp real: o celular simulado pelo adaptador falso.
- A janela que faz a mesclagem (Mesclar em pendente): a jornada prepara o mesclado pela API, porque o que está sendo provado é o resultado dele em Atendimentos.
