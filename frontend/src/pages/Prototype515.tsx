// PROTÓTIPO #515 — descartável, não vai para a main.
// Plano: duas versões do cartão da prévia do link na mensagem recebida, dentro do
// balão e acima do texto, na tela da conversa (Chamados). A versão A põe a miniatura
// em cima, na largura do cartão; a B põe a miniatura à esquerda do texto.
// Telas: ?prototype=515&variante=A|B&tema=claro|escuro&captura=1
// Casos na mesma conversa: 1 com miniatura, 2 sem miniatura, 3 título e descrição
// bem longos, 4 mensagem enviada com link e sem cartão, e 5 link recebido sem prévia.
// Dados e miniaturas fictícios (o repositório é público).
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Lock,
  Mic,
  Paperclip,
  SendHorizontal,
  Smile,
} from 'lucide-react'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/gcaspp-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/gcaspp-simbolo-escuro.svg'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// --- dados fictícios -------------------------------------------------------

type Preview = {
  url: string
  domain: string
  title: string
  description: string
  image?: string
}

type Entry = {
  id: string
  at: string
  direction: 'inbound' | 'outbound'
  body: string
  preview?: Preview
  status?: string
}

const chuva: Preview = {
  url: 'https://g1.globo.com/sp/campinas-regiao/noticia/2026/11/27/chuva-forte-deixa-bairros-de-campinas-sem-energia.ghtml',
  domain: 'g1.globo.com',
  title: 'Chuva forte deixa bairros de Campinas sem energia nesta sexta-feira',
  description:
    'Segundo a concessionária, cerca de 12 mil clientes ficaram sem luz depois do temporal da madrugada; equipes trabalham no restabelecimento.',
  image: '/prototype/link-chuva.svg',
}

const iptu: Preview = {
  url: 'https://www.sumare.sp.gov.br/noticias/2026/11/iptu-2027-calendario',
  domain: 'sumare.sp.gov.br',
  title: 'Prefeitura de Sumaré publica o calendário do IPTU 2027',
  description:
    'O documento traz as datas de vencimento, as faixas de desconto para pagamento à vista e o passo a passo para emitir a guia pelo portal.',
}

const edital: Preview = {
  url: 'https://www.gov.br/compras/pt-br/noticias/2026/11/portal-nacional-de-contratacoes-publicas-divulga-novo-calendario',
  domain: 'gov.br',
  title:
    'Portal Nacional de Contratações Públicas divulga novo calendário de publicação de editais, muda prazos de recursos e orienta órgãos municipais sobre a adaptação das rotinas de compra',
  description:
    'A atualização vale para todos os órgãos que usam o sistema federal e prevê a publicação dos editais com no mínimo oito dias úteis de antecedência, a abertura de prazo para pedidos de esclarecimento em até dois dias úteis depois da divulgação e a resposta obrigatória antes do início da disputa. O comunicado também orienta os municípios a revisarem os modelos de edital, a conferirem o cadastro dos responsáveis e a procurarem o suporte antes de publicar novos certames, para evitar o cancelamento de processos já em andamento.',
  image: '/prototype/link-edital.svg',
}

// Sem prévia: a mensagem fica só com o texto e o link clicável.
const conversa: Entry[] = [
  {
    id: 'caso-5',
    at: '09:58',
    direction: 'inbound',
    body: 'Bom dia! O endereço do portal da prefeitura é https://sumare.sp.gov.br — é por lá que a gente consulta o protocolo.',
  },
  {
    id: 'caso-1',
    at: '10:02',
    direction: 'inbound',
    body: 'Bom dia! Segue a notícia que comentei: https://g1.globo.com/sp/campinas-regiao/noticia/2026/11/27/chuva-forte-deixa-bairros-de-campinas-sem-energia.ghtml',
    preview: chuva,
  },
  {
    id: 'caso-2',
    at: '10:05',
    direction: 'inbound',
    body: 'O calendário do IPTU 2027 já está publicado: https://www.sumare.sp.gov.br/noticias/2026/11/iptu-2027-calendario',
    preview: iptu,
  },
  {
    id: 'caso-3',
    at: '10:08',
    direction: 'inbound',
    body: 'Esse é o portal que o órgão usa: https://www.gov.br/compras/pt-br/noticias/2026/11/portal-nacional-de-contratacoes-publicas-divulga-novo-calendario',
    preview: edital,
  },
  {
    id: 'caso-4',
    at: '10:11',
    direction: 'outbound',
    body: 'Recebi, obrigado! Vou repassar ao setor responsável. O edital completo está aqui: https://www.gov.br/compras/pt-br/editais/2026/11/pregao-eletronico-042-2026',
    status: 'Lida',
  },
]

// --- cartão da prévia ------------------------------------------------------

// O cartão inteiro é o link, como no WhatsApp Web. O nome acessível é o título do
// site; miniatura, descrição e domínio são decorativos para o leitor de tela.
function LinkPreviewCard({ preview, variante }: { preview: Preview; variante: Variante }) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={preview.title}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        'group/card flex w-full overflow-hidden rounded-(--radius-8) border border-line bg-muted text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus hover:border-ink-faint',
        variante === 'A' ? 'flex-col' : 'flex-row items-stretch',
      )}
    >
      <span aria-hidden className="contents">
        {preview.image && variante === 'A' && (
          <img
            src={preview.image}
            alt=""
            className="h-40 w-full shrink-0 border-b border-line-soft object-cover"
          />
        )}
        {preview.image && variante === 'B' && (
          <img
            src={preview.image}
            alt=""
            className="w-[5.5rem] shrink-0 self-stretch border-r border-line-soft object-cover"
          />
        )}
        <span
          className={cn(
            'flex min-w-0 flex-1 flex-col gap-0.5',
            variante === 'A' ? 'px-3 py-2' : 'px-2.5 py-2',
          )}
        >
          <span className="body-strong line-clamp-2 break-words group-hover/card:underline group-hover/card:underline-offset-2">
            {preview.title}
          </span>
          <span className="caption line-clamp-2 break-words text-ink-soft">
            {preview.description}
          </span>
          <span className="caption mt-0.5 truncate text-ink-faint">{preview.domain}</span>
        </span>
      </span>
    </a>
  )
}

// --- balão -----------------------------------------------------------------

// Links do texto com a mesma aparência da regra 45 (sublinhado, abrem em aba nova).
function MessageText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g)
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('http') ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 [overflow-wrap:anywhere] hover:no-underline"
            onClick={(event) => event.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  )
}

function Bubble({ entry, variante }: { entry: Entry; variante: Variante }) {
  const outbound = entry.direction === 'outbound'
  return (
    <li
      id={entry.id}
      aria-label={outbound ? 'Mensagem enviada' : 'Mensagem recebida'}
      data-slot="message-bubble-row"
      className={cn(
        'flex max-w-[78%] flex-col gap-1',
        outbound ? 'items-end self-end' : 'items-start self-start',
      )}
    >
      <div
        data-slot="message-bubble"
        className={cn(
          'flex min-w-0 flex-col gap-1 rounded-(--radius-12) border px-3 py-2',
          // Com prévia, o texto quebra na largura do cartão (o balão fica do tamanho dele),
          // como no WhatsApp Web.
          entry.preview && !outbound && 'w-[21.5rem] max-w-full',
          outbound
            ? 'rounded-br-(--radius-6) border-primary bg-primary text-primary-foreground'
            : 'rounded-bl-(--radius-6) border-line bg-card',
        )}
      >
        {entry.preview && !outbound && (
          <LinkPreviewCard preview={entry.preview} variante={variante} />
        )}
        <p className="whitespace-pre-wrap break-words">
          <MessageText text={entry.body} />
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={cn(
              'mono-num caption',
              outbound ? 'text-primary-foreground' : 'text-ink-soft',
            )}
          >
            {entry.at}
          </span>
          {entry.status && (
            <span
              className={cn(
                'caption font-medium',
                outbound ? 'text-primary-foreground' : 'text-ink-soft',
              )}
            >
              · {entry.status}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}

// --- tela ------------------------------------------------------------------

type Variante = 'A' | 'B'
type Tema = 'claro' | 'escuro'

const params = new URLSearchParams(window.location.search)
const varianteParam = (params.get('variante') ?? 'A') as Variante
const temaParam = (params.get('tema') ?? 'claro') as Tema
const captura = params.get('captura') === '1'

const variantes: { id: Variante; titulo: string }[] = [
  { id: 'A', titulo: 'A · miniatura em cima' },
  { id: 'B', titulo: 'B · miniatura ao lado' },
]

function campos(rotulo: string, valor: string) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label text-ink-soft">{rotulo}</span>
      <span className="break-words">{valor}</span>
    </div>
  )
}

export default function Prototype515() {
  const [variante, setVariante] = useState<Variante>(varianteParam)
  const [tema, setTema] = useState<Tema>(temaParam)
  const lista = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
  }, [tema])

  // Como a tela real: abre no fim da conversa.
  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight })
  }, [])

  // Troca de versão pela URL, para o endereço ser compartilhável e sobreviver ao recarregar.
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('variante', variante)
    window.history.replaceState(null, '', url)
  }, [variante])

  // As setas trocam de versão, menos quando o foco está num campo.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null
      if (alvo?.closest('input, textarea, [contenteditable]')) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      setVariante((atual) => (atual === 'A' ? 'B' : 'A'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="flex h-dvh flex-col bg-background text-foreground"
      style={{ '--header-height': '3.5rem' } as CSSProperties}
    >
      <header className="flex h-(--header-height) shrink-0 items-center justify-between border-b border-line bg-card px-6">
        <div className="flex items-center gap-2.5">
          <img src={tema === 'escuro' ? symbolDark : symbol} alt="" className="h-8 w-8" />
          <div>
            <p className="body-strong leading-tight">GCASPP LAB</p>
            <p className="caption text-ink-soft">Central de Atendimento</p>
          </div>
        </div>
        <Button variant="outline" size="icon" aria-label="Notificações">
          <Bell strokeWidth={1.7} aria-hidden />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-(--sidebar-width) shrink-0 flex-col gap-1 border-r border-line bg-card px-3 py-4 text-sm">
          <p className="overline px-2 pb-1 text-ink-faint">Helpdesk</p>
          <p className="rounded-(--radius-7) bg-accent-soft px-2 py-2 font-medium text-accent-strong">
            Chamados
          </p>
          <p className="px-2 py-2">Atendimentos</p>
          <p className="px-2 py-2">Dashboard</p>
          <p className="px-2 py-2">Contatos</p>
          <p className="px-2 py-2">Conexão</p>
          <p className="overline px-2 pt-6 pb-1 text-ink-faint">Cadastro</p>
          <p className="px-2 py-2">Órgãos</p>
          <p className="px-2 py-2">Módulos</p>
          <p className="px-2 py-2">Assuntos</p>
          <p className="px-2 py-2">Setores</p>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-line-soft bg-background">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-[30px]">
              <Button variant="ghost" size="icon" aria-label="Voltar à lista">
                <ArrowLeft strokeWidth={1.7} aria-hidden />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="caption text-ink-faint">
                  Chamados · Suporte Sistemas · <span className="mono-num">2026-000123</span>
                </p>
                <h1 className="title-page truncate">Maria Oliveira</h1>
                <p className="caption text-ink-soft">(19) 99999-0001</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost">Transferir</Button>
                <Button variant="outline">Encerrar</Button>
              </div>
            </div>
          </header>

          <div className="grid min-h-0 w-full flex-1 grid-cols-[minmax(0,1fr)_380px] gap-4 px-4 py-4 md:px-[30px] md:py-[30px]">
            <Card role="region" aria-label="Conversa" className="flex min-h-0 flex-col">
              <div
                ref={lista}
                data-slot="message-list"
                className="flex-1 overflow-y-auto px-4 py-4"
              >
                <ol className="flex flex-col gap-2">
                  {conversa.map((entry) => (
                    <Bubble key={entry.id} entry={entry} variante={variante} />
                  ))}
                </ol>
              </div>
              <div className="flex items-end gap-2 border-t border-line-soft px-4 py-3">
                <Button variant="ghost" size="icon" aria-label="Anexar arquivo">
                  <Paperclip strokeWidth={1.7} aria-hidden />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Escolher emoji">
                  <Smile strokeWidth={1.7} aria-hidden />
                </Button>
                <Textarea
                  aria-label="Mensagem"
                  placeholder="Escreva a mensagem"
                  rows={1}
                  className="max-h-40 min-h-9"
                />
                <Button variant="ghost" size="icon" aria-label="Gravar áudio">
                  <Mic strokeWidth={1.7} aria-hidden />
                </Button>
                <Button size="icon" aria-label="Enviar mensagem">
                  <SendHorizontal strokeWidth={1.7} aria-hidden />
                </Button>
              </div>
            </Card>

            <Card role="region" aria-labelledby="atendimento" className="min-h-0">
              <CardHeader>
                <CardTitle id="atendimento">Atendimento</CardTitle>
              </CardHeader>
              <Tabs value="detalhes" className="min-h-0 flex-1 px-5 pb-5">
                <TabsList>
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>
                <TabsContent value="detalhes" className="flex flex-col gap-4 pt-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="label text-ink-soft">Situação</span>
                    <Badge tone="success">Em atendimento</Badge>
                  </div>
                  {campos('Contato', 'Maria Oliveira')}
                  {campos('Telefone', '(19) 99999-0001')}
                  {campos('Órgão', 'Prefeitura de Hortolândia — Hortolândia')}
                  <div className="flex flex-col gap-1">
                    <span className="label text-ink-soft">Módulos</span>
                    <span className="flex flex-wrap gap-1">
                      <Badge variant="tag">Protocolo</Badge>
                    </span>
                  </div>
                  {campos('Assunto', 'Dúvida sobre o IPTU 2027')}
                  {campos('Responsável', 'Você')}
                  <div className="mt-auto flex items-center gap-2 border-t border-line-soft pt-3 text-ink-soft">
                    <Lock strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
                    <span className="caption">
                      O cartão da prévia só aparece nas mensagens recebidas.
                    </span>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </main>
      </div>

      {!captura && (
        <div className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <Button
            variant="outline"
            size="icon"
            aria-label="Versão anterior"
            onClick={() => setVariante((atual) => (atual === 'A' ? 'B' : 'A'))}
          >
            <ArrowLeft strokeWidth={1.7} aria-hidden />
          </Button>
          <span className="min-w-40 text-center font-medium">
            {variantes.find((v) => v.id === variante)?.titulo}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próxima versão"
            onClick={() => setVariante((atual) => (atual === 'A' ? 'B' : 'A'))}
          >
            <ArrowRight strokeWidth={1.7} aria-hidden />
          </Button>
          <label className="ml-2 flex items-center gap-1">
            Tema
            <select
              aria-label="Tema"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={tema}
              onChange={(event) => setTema(event.target.value as Tema)}
            >
              <option value="claro">Claro</option>
              <option value="escuro">Escuro</option>
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
