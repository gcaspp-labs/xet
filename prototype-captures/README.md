# Protótipo #320 — proposta para aprovação

Branch: `prototype/320` (protótipo descartável, dados fictícios). Telas desktop.

Execute o frontend da branch em uma porta livre, com `BACKEND_URL` apontando para uma porta sem serviço, e abra `/atendimentos?prototype=320`. A barra inferior troca entre a lista, a ficha do registro por telefone e a aba Histórico dela, além do tema. Parâmetros: `tela=lista|detalhe|historico`, `canal=todos|whatsapp|telefone`, `tema=claro|escuro|contraste` e `captura=1` (esconde a barra).

O que a proposta mostra:

- **Marca Telefone:** na lista de Atendimentos, a linha do registro por telefone ganha a Tag "Telefone" com ícone de telefone, logo abaixo da situação. Os registros de WhatsApp não ganham marca, como pede a issue; a Tag é categoria (não situação), por isso não compete com a pílula de Encerrado/Transferido/Cancelado. A tabela não ganha coluna, então nada encolhe.
- **Filtro Canal:** primeiro `Select` da segunda linha (Todos, WhatsApp, Telefone), ao lado do período e antes de Responsável, Módulo e Assunto. O valor vai para o endereço como os outros filtros (`?canal=telefone`), volta à página 1 e sobrevive a recarregar; a barra inferior mostra o endereço simulado.
- **Detalhe do registro por telefone:** no lugar da conversa, um painel com o ícone de telefone, "Atendimento por telefone, sem conversa" e a ligação (início, fim e duração), sem área de mensagens nem campo de envio. No pé do painel, quem registrou e quando. Ao lado, Detalhes ganha a linha **Canal** com a mesma Tag, junto de Situação; os campos de encerramento (assunto, resolução, módulos, início e fim) continuam como nos outros encerrados, e o botão Corrigir segue no topo.
- **Histórico do contato e do órgão:** a Tag Telefone entra na linha de meta de cada item (setor · órgão), sem espremer o protocolo nem a situação; os de WhatsApp ficam como hoje.

Temas: claro, escuro e alto contraste só com tokens. Contraste da Tag: `accent-strong` sobre `accent-soft` — 11,5:1 no claro (`#00304D` / `#DDEEF5`) e 7,05:1 no escuro (`#86CBE2` / `#143649`), acima de 7:1.

Capturas (1440×900): `320-lista-todos-claro.png` (lista completa, 3 registros por telefone com a marca), `320-lista-telefone-claro.png` (filtro Canal em Telefone, 3 de 8), `320-lista-telefone-escuro.png`, `320-detalhe-claro.png` (sem conversa, Canal nos Detalhes), `320-historico-claro.png` (marca no histórico do contato e do órgão).
