# Consultar chamados em Atendimentos

Atendimentos é o histórico dos chamados encerrados: a pessoa busca, filtra, ordena e abre a ficha só leitura de cada um.

## Sub-features

- [jornada] A lista traz só chamados encerrados (encerrado, cancelado e transferido), do mais recente ao mais antigo; o chamado ainda aberto não aparece.
- [jornada] A situação distingue Encerrado, Cancelado e Transferido, com o setor de destino ("para <setor>").
- [jornada] O atendente não tem filtro de Situação nem botão de novo chamado.
- [jornada] Busca por texto sem acentos e maiúsculas, e filtros de Responsável, Módulo e Assunto, com sugestões nos dois últimos.
- [jornada] Módulo é texto contido: um texto presente em mais de um módulo traz o chamado uma vez só.
- [jornada] Período (Hoje, Datas, Todo o período) e a mensagem "Nenhum chamado encontrado." quando nada bate.
- [jornada] Clicar no título de uma coluna ordena e guarda a ordem no endereço; recarregar mantém busca e ordem.
- [jornada] Clicar na linha abre a ficha só leitura em `/atendimentos/<id>`, e voltar devolve a lista.
- [jornada] O administrador vê a coluna Setor, com Responsável e Módulo travados até escolher um setor; trocar de setor limpa os dois.
- [jornada] Pela API, filtrar por situação responde 400, e o atendente pedindo outro setor recebe 403.
- [não coberto] Paginação, ordem pelas demais colunas e correção do atendimento na ficha (`atendimentos.spec.ts`, `correction.spec.ts`).
- [não coberto] Abas Detalhes e Histórico da ficha e o chamado anterior de uma transferência (`ficha-atendimento.spec.ts`; o chamado anterior também está em `transfer`).

## How to get to it

1. Entre como atendente (ou administrador) e escolha "Atendimentos" no menu Helpdesk.
2. A lista abre com os encerrados mais recentes. Use a busca e os filtros no alto.
3. Clique no título de uma coluna para ordenar, ou numa linha para abrir a ficha.

## Driving it

```bash
scripts/verify/scripts/drive.sh consult-closed-tickets
```

- Os chamados encerrados vêm de sessões de API das pessoas do setor (`t.apiAs`): assumir, encerrar, cancelar e transferir. Isso é preparação; o que a jornada prova é a tela.
- Linhas: `getByRole('table').locator('tbody').getByRole('row')`. Busca: `getByRole('searchbox', { name: 'Buscar chamados' })`.
- Responsável e Setor são `getByRole('combobox', { name })` com `getByRole('option')`. Módulo e Assunto também são combobox, mas de texto: use `fill` e, para fechar as sugestões, `Escape`.
- A linha tem um link que se estende sobre ela; a jornada clica numa célula da linha.

## Gotchas

- Com a lista de sugestões aberta, o resto da página sai da árvore de acessibilidade: feche com `Escape` antes de olhar as linhas.
- O período "Hoje" usa o horário de Brasília, o mesmo das jornadas; um encerramento perto da meia-noite pode mudar de dia.
- O administrador vê chamados de todos os setores do banco da execução: a jornada escolhe o setor antes de contar linhas.
- Responsável e Módulo no endereço só valem com setor; sem setor, a tela os ignora.

## Estado final observável

- **Tela:** a lista, o filtro e a ficha como descritos acima, com as capturas numeradas.
- **`tickets`:** quatro chamados encerrados no setor de origem (um transferido, um cancelado, dois encerrados) e um aberto fora da lista, sem nenhum alterado pela consulta.
- **API:** `GET /api/closed-tickets?status=queued` responde 400; `?sectorId=<outro setor>` do atendente responde 403.
