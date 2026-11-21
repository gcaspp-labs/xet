# Órgãos e contatos

O cadastro de quem é atendido: os órgãos públicos clientes, com o município, e os contatos, que são as pessoas que conversam pelo WhatsApp.

## Regras

1. Os clientes atendidos são pessoas físicas, em geral servidores públicos, vinculadas a um órgão.
2. Os órgãos são pré-cadastrados por supervisores e administradores, com nome, município e CNPJ opcional, único quando informado.
3. O nome do órgão é único dentro do município, sem diferenciar maiúsculas nem acentos; o mesmo nome pode existir em outra cidade.
4. O CNPJ é validado pelos dígitos verificadores e aceita o formato numérico e o alfanumérico emitido pela Receita Federal desde julho de 2026.
5. Os municípios são os de São Paulo, com nome e código AUDESP, carregados da lista oficial do TCE-SP. Não têm tela de cadastro.
6. Nas listas, buscas e detalhes, o órgão aparece com o município ao lado, porque um nome como "Câmara Municipal" é ambíguo entre cidades.
7. Ao cadastrar um órgão, supervisores e administradores podem consultar o CNPJ para sugerir o nome e o município. Quem cadastra confere os dados antes de salvar.
8. Se a consulta do CNPJ falhar ou não encontrar o CNPJ, o cadastro manual continua disponível. Município fora da lista, como o de um órgão de outro estado, fica para escolher à mão. A consulta não salva nada nem guarda outros dados do CNPJ.
9. O contato é a pessoa que conversa pelo WhatsApp, com nome e telefone, vinculada a um órgão principal pré-cadastrado. É raro um contato representar mais de um órgão.
10. Cada chamado fica vinculado ao contato e ao órgão. O órgão vem do cadastro do contato e pode ser alterado no formulário de encerramento, só para aquele chamado.
11. Órgãos são cadastrados manualmente. Contatos são cadastrados manualmente ou importados do WhatsApp do setor (ver [contact-import.md](contact-import.md)).
12. Cada telefone corresponde a um único contato. Quando um telefone é usado por mais de uma pessoa, o sistema não as distingue: todas aparecem no mesmo contato.
13. A busca localiza órgãos e contatos por nome, município, telefone e CNPJ, sem diferenciar maiúsculas nem acentos ("camara" encontra "Câmara"). Na busca de órgãos, o termo é quebrado em palavras pelos espaços, e cada palavra precisa aparecer no nome do órgão, no município ou no CNPJ, em qualquer ordem: "câmara jales" e "jales câmara" encontram a Câmara de Jales, e uma palavra que não aparece em nenhum deles zera o resultado. Um trecho de CNPJ só encontra órgãos que têm CNPJ.
14. A lista de contatos e a busca de "Novo chamado" filtram também por município e por órgão. O filtro de município mostra só os que têm órgão cadastrado; escolhido o município, o filtro de órgão mostra só os dele.
15. Mensagens de números desconhecidos entram normalmente na fila.
16. A mensagem recebida é ligada ao contato pelo identificador do WhatsApp gravado nele. Na primeira mensagem de um contato cadastrado à mão, ainda sem esse identificador, vale o telefone, com ou sem o nono dígito do celular (5511987654321 e 551187654321), e o identificador passa a ser gravado.
17. Número desconhecido gera um contato não cadastrado, com o nome do perfil do WhatsApp ou, sem ele, o telefone.
18. Se o WhatsApp não informar o telefone (contato identificado só por LID), o contato fica sem telefone, com o nome do perfil ou "Contato sem telefone"; o atendente informa o telefone ao cadastrá-lo.
19. Na conversa de um chamado aberto com contato não cadastrado, um aviso no topo e um botão junto do contato no painel lateral permitem cadastrá-lo sem encerrar. Vale para todos os papéis que podem abrir o chamado, inclusive com ele na fila, sem assumir.
20. Nesse cadastro, o órgão é opcional: sem órgão, grava-se só o nome, e o contato continua não cadastrado, com o aviso na conversa. Com órgão, vale o cadastro completo.
21. Mensagens recebidas não trocam o nome salvo do contato.
22. Antes de encerrar um chamado de número desconhecido, o atendente cadastra o contato e o vincula a um órgão, mesmo que o nome já tenha sido salvo. O cancelamento dispensa o cadastro.
23. Ao cadastrar o contato, os chamados abertos dele ainda sem órgão passam a ter o órgão do cadastro, com registro na auditoria. Chamados que já têm órgão não mudam; a troca continua sendo feita no encerramento.
24. O contato pode pertencer a vários setores. O setor organiza a lista e não restringe o acesso: o cadastro é único para todos os setores.
25. No cadastro manual, ao menos um setor é obrigatório, com o setor de quem cadastra já marcado; o administrador escolhe.
26. Atendentes e supervisores marcam ou desmarcam apenas o próprio setor e o módulo dele. Os demais setores e módulos do contato aparecem só para leitura e são preservados ao salvar. O administrador altera qualquer um.
27. A lista de contatos abre em "Meu setor", com opção de ver todos, e a busca de "Novo chamado" usa o mesmo filtro. O administrador abre em todos.
28. O contato entra no setor sozinho ao escrever para o número dele, ao receber uma conversa iniciada por ele, em mensagem enviada pelo celular do setor ou ao ser transferido para ele.
29. O módulo no contato é opcional, e o contato tem no máximo um em cada setor. Os módulos filtram a lista, e o do setor do chamado vem marcado no formulário de encerramento.
30. A lista de contatos mostra os setores do contato e o módulo em cada um.
31. As alterações de setores e módulos do contato, inclusive as automáticas, ficam registradas na auditoria.
32. A lista de contatos é paginada e ordena por Contato (padrão) ou por Órgão, como em [interface.md](interface.md). Nomes iguais mantêm sempre a mesma ordem, e contatos sem órgão ficam no fim da ordem por órgão. O total conta cada contato uma vez, mesmo em vários setores.
33. Na tela Contatos, a busca e os filtros também ficam no endereço (`?busca=`, `?setor=`, `?modulo=`, `?municipio=`, `?orgao=`). A busca de "Novo chamado" carrega a próxima página de contatos sozinha ao chegar no fim da lista, até mostrar todos os resultados, respeitando a busca e os filtros atuais. Mudar a busca ou um filtro recomeça do início da lista. A lista não tem rodapé de contagem. Pelo teclado, as setas percorrem os contatos e, ao chegar no último carregado, vem a próxima página.
34. A lista de órgãos é paginada e ordena por Órgão (padrão), Município ou CNPJ, como em [interface.md](interface.md), com a busca no endereço (`?busca=`). Nomes iguais mantêm sempre a mesma ordem, e órgãos sem CNPJ ficam no fim da ordem por CNPJ.
35. Os seletores de órgão (filtro do Dashboard, filtro de Contatos, cadastro e importação de contatos, encerramento) carregam a próxima página sozinhos ao chegar no fim da lista, até mostrar todos os resultados da busca, também pelo teclado. Digitar no campo ou trocar o município filtra no servidor e recomeça do início da lista. Enquanto falta carregar algo, o fim da lista mostra "Mostrando X de Y órgãos"; com a lista completa, nada aparece.
36. Em cada opção do seletor de órgão, o nome aparece inteiro, quebrando de linha se for longo, e abaixo vêm o município e o CNPJ ("município · CNPJ"); órgão sem CNPJ mostra só o município. A lista abre mais larga que o campo, até 32rem, sem passar da largura da tela. Depois de escolhido, o campo mostra o nome do órgão com o município.

## Fora do escopo / limites conhecidos

- A importação de contatos por planilha (CSV) fica para uma etapa posterior.
- As páginas dos seletores continuam de 20 em 20.
- Os outros seletores (município, setor, atendente, módulo) já carregam a lista inteira. As listas das telas Contatos e Órgãos seguem paginadas por página (regras 32 e 34).

## Relacionado

- Dados: `municipalities`, `organizations`, `contacts`, `contact_sectors`, `contact_modules`, `audit_logs`. Pesquisa: `docs/research/cnpj-lookup.md`.

## Histórico

- 2026-11-11: lista de órgãos paginada e ordenável (#127).
- 2026-11-11: lista de contatos paginada e ordenável (#126).
- 2026-11-11: regras migradas do `spec.md` (Órgãos e contatos; Órgãos e contatos › Setores e módulos do contato).
- 2026-11-14: a janela "Nova conversa" passa a "Novo chamado" nas regras 14, 27 e 33, só texto (ticket [#185](https://github.com/gcaspp-labs/xet/issues/185)).
- 2026-11-15: regra 12 alterada; spec [#173](https://github.com/gcaspp-labs/xet/issues/173), PRs [#189](https://github.com/gcaspp-labs/xet/pull/189), [#190](https://github.com/gcaspp-labs/xet/pull/190). Dizia "Cada telefone corresponde a um único contato. Quando um telefone é usado por mais de uma pessoa, o atendente anota no chamado com quem falou.".
- 2026-11-17: regra 35 alterada e regra 36 adicionada; spec [#227](https://github.com/gcaspp-labs/xet/issues/227), PRs [#231](https://github.com/gcaspp-labs/xet/pull/231), [#232](https://github.com/gcaspp-labs/xet/pull/232). A 35 dizia "Os seletores de órgão (filtros, cadastro e importação de contatos, encerramento) mostram os 20 primeiros resultados da busca e avisam quando há mais, pedindo para refinar.".
- 2026-11-17: regra 33 alterada; spec [#227](https://github.com/gcaspp-labs/xet/issues/227), PR [#233](https://github.com/gcaspp-labs/xet/pull/233). Dizia, no fim, "A busca de "Novo chamado" mostra os 20 primeiros resultados.".
- 2026-11-20: regra 13 alterada; ticket [#226](https://github.com/gcaspp-labs/xet/issues/226). A busca de órgãos passa a aceitar palavras de campos diferentes, em qualquer ordem. Dizia "A busca localiza órgãos e contatos por nome, município, telefone e CNPJ. A busca por nome não diferencia maiúsculas nem acentos ("camara" encontra "Câmara").".
