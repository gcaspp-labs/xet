# Protótipo #318 — proposta para aprovação

Branch: `prototype/318` (protótipo descartável, dados fictícios). Tela Dashboard.

Execute o frontend da branch em uma porta livre, com `BACKEND_URL` apontando para uma porta sem serviço, e abra `/dashboard?prototype=318`. A barra inferior troca o canal (Todos, WhatsApp, Telefone) e o tema; as setas ← → também trocam o canal. Fora das capturas, os parâmetros de estado são `canal=todos|whatsapp|telefone`, `tema=claro|escuro|contraste`, `rolar=tabela` e `captura=1` (esconde a barra).

O que a proposta mostra:

- Filtro **Canal** entre Setor e Atendente, com "Todos os canais" (padrão), "WhatsApp" e "Telefone".
- Com um canal escolhido, **Encerrados**, **Transferidos**, **Cancelados**, **Tempo médio de atendimento** e a tabela por atendente mostram os números daquele canal.
- Nos demais números — **Na fila**, **Em atendimento**, **Recebidos**, **Iniciados** e **Tempo médio de espera** — aparece "—" com "Não se aplica ao filtro", como já acontece com os outros filtros (regra 13).
- Na tabela por atendente, **Em atendimento** e **Iniciados** ficam com "—" e a nota embaixo diz quais colunas o filtro deixou de fora; as demais colunas somam o canal.
- Com **Telefone**, a tabela lista só quem tem registro por telefone; zero aparece como "0" (Transferidos e Cancelados), e não como "—".
- O tempo médio de atendimento do registro por telefone usa o início e o fim informados.

Capturas desktop (1440×900):

- `318-todos.png` — padrão, Todos os canais.
- `318-todos-escuro.png` — padrão no tema escuro.
- `318-whatsapp.png` — filtro WhatsApp: Recebidos, Iniciados, espera, Na fila e Em atendimento como "Não se aplica ao filtro".
- `318-whatsapp-tabela.png` — tabela por atendente com Em atendimento e Iniciados fora do filtro.
- `318-telefone.png` — filtro Telefone: Encerrados 7, Transferidos 0 e Cancelados 0.
- `318-telefone-tabela.png` — tabela só com quem registrou por telefone e a nota das colunas que não se aplicam.
- `318-telefone-escuro.png` — filtro Telefone no tema escuro.

Renato, a proposta atende ou o que gostaria de mudar?
