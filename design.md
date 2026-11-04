# Design — Central de atendimento via WhatsApp

A interface segue o design system da GCASPP LAB: [gcaspp-labs/glab-design-system](https://github.com/gcaspp-labs/glab-design-system). O brand book do repositório (README) é a referência de marca, tom, cor, tipografia, espaço e layout; este documento diz como aplicá-lo com shadcn/ui neste sistema.

Regra geral: o shadcn/ui fornece o comportamento e a acessibilidade dos componentes; a aparência vem dos tokens e das diretrizes do design system. Quando os dois divergirem, vale o design system.

## Dependência

- O design system entra como dependência npm do frontend, fixada por commit: `npm install github:gcaspp-labs/glab-design-system#3c32eca` (versão 1.0.0). Quando o repositório tiver tags, trocar o commit pela tag (`#v1.0.0`).
- Usamos somente `tokens/tokens.css`, os ícones e os logos. O `css/components.css` **não** é importado: os componentes vêm do shadcn, estilizados com os tokens.
- Atualizar o design system é uma mudança deliberada: trocar a versão no `package.json`, conferir o CHANGELOG e revisar as telas.

## Tokens e tema

- `tokens/tokens.css` é importado no `src/index.css` antes do Tailwind. Ele define as variáveis (`--ink`, `--paper`, `--accent`…) para o tema claro, o escuro pelo sistema operacional e os temas forçados por `data-theme`.
- As variáveis do shadcn são mapeadas uma única vez para os tokens, sem bloco `.dark` próprio: como os tokens já mudam com o tema, o shadcn acompanha automaticamente.
- O mapeamento é feito direto nas cores do Tailwind (`--color-*` em `@theme inline`), sem as variáveis intermediárias do shadcn: a variável `--accent` do shadcn colide com o token `--accent` do design system.
- A variante `dark:` do Tailwind segue a mesma regra do design system: `data-theme="dark"`, ou tema escuro do sistema operacional sem `data-theme="light"`.
- A pessoa escolhe Claro, Escuro ou Sistema no menu de configurações; sem escolha, vale Sistema, que segue o sistema operacional. A escolha fica no navegador e é aplicada em `data-theme` antes de pintar a tela. O `color-scheme` acompanha o tema, para barras de rolagem e seletores nativos, e os avisos (`sonner`) também.
- O alto contraste é uma camada do projeto sobre os tokens, que o design system não tem, ligada por `data-contrast="high"`, com valores para o tema claro e o escuro. Texto com contraste de ao menos 7:1 sobre o fundo; bordas e foco bem visíveis. O tamanho do texto usa os mesmos estilos de texto, multiplicados por um fator (100%, 115% ou 130%). Os dois são aplicados antes de pintar a tela, como o tema. Com o texto maior que o padrão (variante `scaled-text`), o painel empilha a coluna lateral e o título da Topbar mantém largura mínima, levando as ações para a linha de baixo.

| Variável do shadcn | Token do design system |
| --- | --- |
| `--background` | `--paper` |
| `--foreground` | `--ink` |
| `--card`, `--popover` | `--surface` |
| `--card-foreground`, `--popover-foreground` | `--ink` |
| `--primary` | `--accent` |
| `--primary-foreground` | `--on-accent` |
| `--secondary`, `--muted`, `--accent` | `--surface-2` |
| `--secondary-foreground`, `--accent-foreground` | `--ink` |
| `--muted-foreground` | `--ink-soft` |
| `--destructive` | `--danger` |
| `--border`, `--input` | `--line` |
| `--ring` | `--focus` |
| `--radius` | `--radius-8` (botões); campos usam `--radius-7` e painéis `--radius-12` diretamente |
| `--sidebar` | `--surface` |
| `--sidebar-foreground` | `--ink-soft` |
| `--sidebar-primary`, `--sidebar-accent` | `--accent-soft` (item ativo) |
| `--sidebar-primary-foreground`, `--sidebar-accent-foreground` | `--accent-strong` |
| `--sidebar-border` | `--line` |

Cores de estado (`--success`, `--warning`, `--danger` e seus `-soft`, `--warning-ink`) são expostas ao Tailwind (`@theme inline`) com os mesmos nomes, para uso em Pill, Note e afins. Não usar cores fixas (`#fff`, `text-white`, paleta padrão do Tailwind) em telas: sempre tokens. Texto sobre `accent` usa `on-accent`.

## Tipografia

- Família IBM Plex, servida localmente pelo pacote Fontsource (`@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-serif`, `@fontsource/ibm-plex-mono`), sem depender do Google Fonts em tempo de execução. Substitui a fonte Geist instalada pelo shadcn.
- Os estilos de texto do design system (`title-page`, `title-panel`, `body`, `label`, `caption`, `overline`, `table-head`, `kpi-value`, `mono-num`…) viram utilitários do Tailwind com os mesmos nomes, gerados a partir das classes `.t-*` do `tokens.css`. Os valores são copiados para `src/index.css` (`@utility`); ao atualizar o design system, conferir se mudaram.
- `sans` para interface (corpo 14px), `serif` peso 600 para títulos, `mono` tabular para números, protocolos (`2026-000123`) e telefones.

## Componentes

| Design system | shadcn/ui | Adaptação |
| --- | --- | --- |
| Button | `Button` | Variantes: `default` = primário (uma vez por tela), `outline` = padrão, `ghost`, `sm`; `destructive` vira texto em `danger`, nunca botão vermelho cheio; botão de ícone 32×32 sempre com `aria-label` |
| Panel | `Card` | `surface`, borda `line`, raio `radius-12`, **sem sombra**; título `title-panel`; corpo sem padding quando contém tabela |
| Drawer | `Sheet` (lado direito) | Largura `drawer-width` (até 92vw), sombra `shadow`, véu `overlay`; título `title-drawer`; rodapé com Cancelar (ghost) e ação primária. Criar e editar registros sempre em Drawer |
| Pill | `Badge` (variante `status`) | Ponto colorido + palavra; `success`, `warning`, `danger`, `neutral`. A palavra é obrigatória |
| Tag | `Badge` (variante `tag`) | `accent-strong` sobre `accent-soft`, raio `radius-6`; para categorias (ex.: módulos), nunca status |
| Chip | `ToggleGroup` | Seleção única; ativo em `accent` com `on-accent` |
| FormField | `Field`, `Label`, `Input`, `Textarea`, `Select`, `Checkbox` | Rótulo `label` em `ink-soft` sempre visível; dica abaixo; raio `radius-7`; foco troca a borda para `accent` |
| SearchBox | `Input` com ícone de busca | Largura máxima 260px; busca imediata, sem botão |
| Table | `Table` | Cabeçalho `table-head`; números em mono à direita; primeira coluna com título e subtítulo |
| Tabs | `Tabs` | Ativa com sublinhado `accent` de 2px |
| Toast | `sonner` | Rodapé central, ~2,5s, ícone de confirmação em `success`, frase no particípio ("Chamado encerrado"), 13px no tamanho Padrão, acompanhando o tamanho do texto. Erros que exigem ação usam Note, não toast |
| Note | `Alert` (variante `warning`) | Ícone de aviso + uma frase em `warning-ink` sobre `warning-soft`, sem título |
| EmptyState | `Empty` | Ícone de 30px a 50% e uma frase em `ink-faint` |
| Sidebar | `Sidebar` | Acompanha o tema, sobre `surface`, em vez de ficar escura nos dois temas como no brand book (decisão do projeto); começa abaixo do Cabeçalho; recolhe para só os ícones, com o botão no topo da própria barra, alinhado à direita e, recolhida, no centro da coluna de ícones, e a escolha fica no navegador; abaixo de 760px vira gaveta, aberta pelo botão do Cabeçalho. Grupos com título fixo: Helpdesk (Atendimento, Contatos, Conexão) e Cadastro (Órgãos, Módulos, Setores). O breadcrumb da Topbar usa o nome do grupo |
| Menu de configurações | `DropdownMenu` | No rodapé da barra lateral, abaixo do nome do usuário: botão "Configurações" com a escolha de tema, as preferências de alertas e de acessibilidade, "Usuários" (só para o administrador) e "Sair". Ícones de 15px |
| Cabeçalho | Componente próprio | Fixo no topo, na largura toda, sobre `surface` com borda `line` e altura `--header-height` (56px): marca à esquerda e notificações à direita |
| Sino de notificações | `Popover` sobre `@base-ui/react` | Botão `ghost` com contador em `accent`, ou em cor de alerta com número desconectado. Número desconectado no topo, depois os chamados na fila com `Button` `sm` "Abrir" (`ghost`) e "Assumir" (`outline`); vazio usa EmptyState. Erro ao assumir aparece como Note dentro da lista. Cabe na largura do celular |
| Topbar | Componente próprio | Fixa abaixo do Cabeçalho, sobre `paper`: voltar nas telas internas (ex.: "Voltar à lista", da conversa para a lista de atendimentos), breadcrumb, título `title-page` e no máximo uma ação primária |
| KpiCard | Componente próprio sobre `Card` | Rótulo `overline`, valor `kpi-value`, subtexto `caption` |

Componentes sem equivalente no design system (ex.: balões de conversa, player de áudio, indicador de conexão) são compostos com os mesmos tokens e regras: `surface` e `line` para contêineres, raios pequenos, sem sombra fora de camadas flutuantes, estados com palavra além da cor.

Player de áudio: componente próprio, usado na gravação e nas mensagens. Botão de tocar e pausar, barra de progresso e tempo em `mono-num`, sobre `surface` e `line`, com os raios pequenos do design system. A barra funciona por teclado e a duração aparece uma única vez.

## Ícones

- `lucide-react` com `strokeWidth={1.7}`, para ficar no traço do design system (grade 24, traço 1,7, pontas arredondadas, `currentColor`). O conjunto próprio do design system é pequeno para as necessidades de um chat (microfone, enviar, play…), por isso o lucide é a fonte única de ícones, configurado nesse traço.
- Tamanhos: 17px no menu, 15px em botões, 30px em estados vazios. Sem emoji e sem ícones preenchidos.

## Marca e layout

- Cabeçalho: símbolo a 32px, `glab-simbolo.svg` no tema claro e `glab-simbolo-escuro.svg` no escuro, + "GCASPP LAB" e, abaixo, o nome do produto **"Central de Atendimento"**. "g-lab" só no rodapé.
- Favicon: símbolo do polvo (`glab-simbolo.svg`), copiado para `frontend/public/favicon.svg`.
- Tela de login: fundo `paper`, Panel central com a assinatura `gcaspp-lab-horizontal.svg`, sem barra lateral.
- Aplicação: Cabeçalho fixo, barra lateral fixa abaixo dele (`sidebar-width`), Topbar fixa, conteúdo com padding `space-30` no desktop e `space-16` no celular, largura máxima `content-max` (exceto a tela de conversas, que usa a largura toda).
- Foco de teclado: outline sólido de 2px em `focus`, afastado 2px. Transições de 150–200ms, desligadas com `prefers-reduced-motion`.

## Conteúdo e tom

- Português do Brasil, linguagem administrativa clara e impessoal ("Assuma o chamado para responder"), sem emoji.
- Caixa de frase em botões, títulos e menus: "Novo contato", "Fila do setor".
- Status em uma palavra ou expressão curta: "Na fila", "Em atendimento", "Encerrado", "Conectado", "Desconectado".
- Toasts no particípio: "Chamado assumido", "Mensagem enviada", "Contato salvo".
- Avisos dizem o problema e a próxima ação numa frase: "Número desconectado. Reconecte pelo QR code."
- Formatos pt-BR: data `02/03/2026`, hora `14:05`, telefone `(11) 99999-0000`, CNPJ `00.000.000/0000-00`.
