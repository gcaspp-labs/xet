// PROTÓTIPO #325 — descartável, não vai para a main.
// Plano: uma proposta (versão única) do cartão de contato na conversa e da prévia
// "👤 Nome" nas listas, com quatro recortes: cartões, falha e antigos, colega do
// setor e o detalhe de Atendimentos (só leitura). Parâmetros de URL para as capturas:
//   ?prototype=325&cenario=cartoes|falha|leitura&tema=claro|escuro|contraste&captura=1
// Dados fictícios. A barra inferior troca o cenário e o tema; fora das capturas.
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  CircleAlert,
  Copy,
  Lock,
  Paperclip,
  RotateCw,
  SendHorizontal,
} from 'lucide-react'
import { Contact } from 'lucide-react'
import { toast } from 'sonner'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Toaster } from '@/components/ui/sonner'
import { dialPhone, formatPhone, organizationLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

// --- dados fictícios -------------------------------------------------------

// Rótulo do órgão como o cartão mostra: nome e município, quando houver.
type ContactCardData = {
  name: string
  phones: string[]
  organization: string | null
  municipality: string | null
}

type Entry =
  | {
      kind: 'message'
      at: string
      direction: 'inbound' | 'outbound'
      type?: 'text' | 'contact' | 'unsupported'
      body?: string
      cards?: ContactCardData[]
      status?: 'Enviando' | 'Enviada' | 'Entregue' | 'Lida' | 'Falhou'
      failureReason?: string
    }
  | { kind: 'log'; at: string; text: string }

const joao: ContactCardData = {
  name: 'João Pereira',
  phones: ['5519988881234'],
  organization: 'Secretaria de Educação',
  municipality: 'Campinas',
}

const anaBeatriz: ContactCardData = {
  name: 'Ana Beatriz Nunes',
  phones: ['5519997774321', '551933334444'],
  organization: 'Departamento de Compras',
  municipality: 'Campinas',
}

const carlosEduardo: ContactCardData = {
  name: 'Carlos Eduardo Lima',
  phones: ['5519996662211'],
  organization: 'Secretaria de Administração',
  municipality: 'Hortolândia',
}

const fernandaSouza: ContactCardData = {
  name: 'Fernanda Souza',
  phones: ['5519985553344'],
  organization: null,
  municipality: null,
}

const roberto: ContactCardData = {
  name: 'Roberto Almeida',
  phones: ['5519994441122'],
  organization: 'Ouvidoria Municipal',
  municipality: 'Campinas',
}

const marcosAmaral: ContactCardData = {
  name: 'Marcos Vinícius Amaral',
  phones: ['5519993338899'],
  organization: 'Secretaria de Saúde',
  municipality: 'Sumaré',
}

const patricia: ContactCardData = {
  name: 'Patrícia Gomes',
  phones: ['5519992221100'],
  organization: 'Secretaria de Meio Ambiente',
  municipality: 'Campinas',
}

const conversaCartoes: Entry[] = [
  {
    kind: 'message',
    at: '09:39',
    direction: 'inbound',
    body: 'Bom dia! O João cuida do processo, segue o contato dele.',
  },
  { kind: 'message', at: '09:40', direction: 'inbound', type: 'contact', cards: [joao] },
  {
    kind: 'message',
    at: '09:47',
    direction: 'inbound',
    type: 'contact',
    cards: [anaBeatriz, carlosEduardo, fernandaSouza],
  },
  {
    kind: 'message',
    at: '09:49',
    direction: 'outbound',
    type: 'contact',
    cards: [roberto],
    status: 'Lida',
  },
]

const conversaFalha: Entry[] = [
  {
    kind: 'message',
    at: '09:39',
    direction: 'inbound',
    body: 'Consegue o contato do setor de saúde?',
  },
  {
    kind: 'message',
    at: '09:41',
    direction: 'outbound',
    type: 'contact',
    cards: [marcosAmaral],
    status: 'Falhou',
    failureReason: 'Número desconectado',
  },
  {
    kind: 'message',
    at: '09:43',
    direction: 'inbound',
    body: 'Esse veio por outro número. O antigo ainda aparece aqui.',
  },
  { kind: 'message', at: '09:44', direction: 'inbound', type: 'unsupported' },
  {
    kind: 'message',
    at: '09:46',
    direction: 'outbound',
    type: 'contact',
    cards: [patricia],
    status: 'Enviando',
  },
]

const conversaLeitura: Entry[] = conversaCartoes

// Listas: a prévia da última mensagem é "👤 Nome" quando é cartão.
type TicketLineData = {
  id: number
  contact: string
  preview: string
  at: string
  protocol: string
  assignee?: string
  mine?: boolean
}

const meusChamados: TicketLineData[] = [
  {
    id: 1,
    contact: 'Maria Oliveira',
    preview: '👤 João Pereira',
    at: '09:51',
    protocol: '2026-000123',
    assignee: 'Você',
    mine: true,
  },
  {
    id: 2,
    contact: 'Fernando Alves',
    preview: '👤 Ana Beatriz Nunes',
    at: '09:38',
    protocol: '2026-000121',
    assignee: 'Você',
  },
  {
    id: 3,
    contact: 'Carla Souza',
    preview: 'Você tem o número do protocolo anterior?',
    at: '09:22',
    protocol: '2026-000118',
    assignee: 'Você',
  },
  {
    id: 4,
    contact: 'Juliana Castro',
    preview: '👤 Patrícia Gomes',
    at: '08:57',
    protocol: '2026-000115',
    assignee: 'Você',
  },
]

const fila: TicketLineData[] = [
  {
    id: 5,
    contact: 'Fernanda Lima',
    preview: '👤 Carlos Eduardo Lima',
    at: 'há 12 min',
    protocol: '2026-000126',
  },
  {
    id: 6,
    contact: 'Paulo Henrique',
    preview: 'Bom dia, preciso de ajuda com o alvará.',
    at: 'há 25 min',
    protocol: '2026-000124',
  },
]

// --- cartão de contato -----------------------------------------------------

async function copyPhone(phone: string) {
  try {
    await navigator.clipboard.writeText(dialPhone(phone))
    toast.success('Telefone copiado')
  } catch {
    toast.error('Não foi possível copiar o telefone.')
  }
}

// Cartão de contato dentro do balão. Recebido: fundo `muted` no balão `card`, com o
// botão de copiar em cada telefone. Enviado: fundo `card` no balão `accent`, sem o
// botão (o cliente recebeu o cartão sem ação) e com a situação no pé do balão.
function ContactCard({ card, outbound }: { card: ContactCardData; outbound: boolean }) {
  const org =
    card.organization && organizationLabel(card.organization, card.municipality)
  return (
    <div
      role="group"
      aria-label={`Contato: ${card.name}, ${card.phones.map(formatPhone).join(', ')}`}
      className={cn(
        'flex w-72 max-w-full items-start gap-2.5 rounded-(--radius-8) border px-2.5 py-2',
        outbound ? 'border-line-soft bg-card text-foreground' : 'border-line-soft bg-muted',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          outbound
            ? 'bg-accent-soft text-accent-strong'
            : 'border border-line-soft bg-card text-accent-strong',
        )}
      >
        <Contact strokeWidth={1.7} className="size-[17px]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="body-strong break-words">{card.name}</p>
        {org && <p className="caption break-words text-ink-soft">{org}</p>}
        <div className="flex flex-col">
          {card.phones.map((phone) => (
            <span key={phone} className="flex items-center gap-1">
              <span className={cn('mono-num', outbound ? 'text-ink-soft' : 'text-ink')}>
                {formatPhone(phone)}
              </span>
              {!outbound && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Copiar telefone ${formatPhone(phone)}`}
                  title="Copiar telefone"
                  className="-my-1 size-6 text-ink-soft hover:text-foreground"
                  onClick={() => void copyPhone(phone)}
                >
                  <Copy strokeWidth={1.7} className="size-[13px]" aria-hidden />
                </Button>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- balões ----------------------------------------------------------------

function Bubble({ entry, modern = true }: { entry: Entry; modern?: boolean }) {
  if (entry.kind === 'log') {
    return (
      <li
        aria-label="Registro do chamado"
        className="caption flex items-start gap-1.5 self-center rounded-(--radius-7) border border-dashed border-line px-2.5 py-1 text-ink-soft"
      >
        <span className="min-w-0">
          {entry.text} · <span className="mono-num">{entry.at}</span>
        </span>
      </li>
    )
  }
  const outbound = entry.direction === 'outbound'
  const contact = entry.type === 'contact'
  return (
    <li
      aria-label={outbound ? 'Mensagem enviada' : 'Mensagem recebida'}
      className={cn(
        'flex max-w-[78%] flex-col gap-1',
        outbound ? 'items-end self-end' : 'items-start self-start',
      )}
    >
      <div
        className={cn(
          'flex min-w-0 flex-col gap-1 rounded-(--radius-12) border',
          contact ? 'p-2' : 'px-3 py-2',
          outbound
            ? modern
              ? 'rounded-br-(--radius-6) border-primary bg-primary text-primary-foreground'
              : 'rounded-br-(--radius-6) border-accent-soft bg-accent-soft'
            : modern
              ? 'rounded-bl-(--radius-6) border-line bg-card'
              : 'rounded-bl-(--radius-6) border-line-soft bg-card',
        )}
      >
        {contact ? (
          <div className="flex flex-col gap-1.5">
            {entry.cards?.map((card) => (
              <ContactCard key={card.name} card={card} outbound={outbound} />
            ))}
          </div>
        ) : entry.type === 'unsupported' ? (
          <p className="italic text-ink-soft">Tipo de mensagem não suportado</p>
        ) : (
          entry.body && <p className="whitespace-pre-wrap break-words">{entry.body}</p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={cn(
              'mono-num caption',
              outbound && modern ? 'text-primary-foreground' : 'text-ink-soft',
            )}
          >
            {entry.at}
          </span>
          {entry.status && (
            <span
              className={cn(
                'caption font-medium',
                outbound && modern ? 'text-primary-foreground' : 'text-ink-soft',
              )}
            >
              · {entry.status}
            </span>
          )}
        </div>
        {entry.failureReason && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className={cn('caption', modern ? 'text-primary-foreground' : 'text-danger')}>
              {entry.failureReason}
            </span>
            <Button size="sm" variant="outline" className="pointer-events-none">
              <RotateCw strokeWidth={1.7} aria-hidden />
              Reenviar
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}

// --- listas ----------------------------------------------------------------

function TicketLine({ ticket }: { ticket: TicketLineData }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 border-l-3 px-4 py-2.5',
        ticket.mine
          ? 'border-primary bg-accent-soft'
          : 'border-transparent',
      )}
    >
      <span className="flex items-center gap-2">
        <span className="body-strong min-w-0 flex-1 truncate">{ticket.contact}</span>
        <span className="mono-num caption text-ink-soft">{ticket.at}</span>
      </span>
      <span className="caption truncate text-ink-soft">{ticket.preview}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="mono-num caption text-ink-faint">{ticket.protocol}</span>
        {ticket.assignee && (
          <span className="caption ml-auto truncate text-ink-faint">{ticket.assignee}</span>
        )}
      </span>
    </div>
  )
}

// --- tela ------------------------------------------------------------------

type Cenario = 'cartoes' | 'falha' | 'leitura' | 'atendimentos'
type Tema = 'claro' | 'escuro' | 'contraste'

const params = new URLSearchParams(window.location.search)
const cenarioParam = (params.get('cenario') ?? 'cartoes') as Cenario
const temaParam = (params.get('tema') ?? 'claro') as Tema
const captura = params.get('captura') === '1'

const conversas: Record<Cenario, Entry[]> = {
  cartoes: conversaCartoes,
  falha: conversaFalha,
  leitura: conversaLeitura,
  atendimentos: conversaCartoes,
}

const titulos: Record<Cenario, string> = {
  cartoes: 'Cartões recebidos e enviados',
  falha: 'Falha, reenvio e contato antigo',
  leitura: 'Colega do setor, sem ações de envio',
  atendimentos: 'Detalhe do Atendimento (encerrado)',
}

export default function Prototype325() {
  const [cenario, setCenario] = useState<Cenario>(cenarioParam)
  const [tema, setTema] = useState<Tema>(temaParam)
  const entries = conversas[cenario]
  const leitura = cenario === 'leitura' || cenario === 'atendimentos'
  const atendimentos = cenario === 'atendimentos'
  const lista = useRef<HTMLDivElement>(null)

  // Como a tela real: mostra sempre a mensagem mais recente.
  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight })
  }, [cenario])

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = tema === 'contraste' ? 'high' : 'normal'
  }, [tema])

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
          <p
            className={cn(
              'rounded-(--radius-7) px-2 py-2',
              !atendimentos && 'bg-accent-soft font-medium text-accent-strong',
            )}
          >
            Chamados
          </p>
          <p
            className={cn(
              'rounded-(--radius-7) px-2 py-2',
              atendimentos && 'bg-accent-soft font-medium text-accent-strong',
            )}
          >
            Atendimentos
          </p>
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
              {atendimentos && (
                <Button variant="ghost" size="icon" aria-label="Voltar à lista">
                  <ArrowLeft strokeWidth={1.7} aria-hidden />
                </Button>
              )}
              <div className="min-w-0 flex-1">
                <p className="caption text-ink-faint">
                  {atendimentos
                    ? 'Suporte Sistemas · 2026-000123'
                    : 'Chamados · Suporte Sistemas · 2026-000123'}
                </p>
                <h1 className="title-page truncate">Maria Oliveira</h1>
                {!atendimentos && <p className="caption text-ink-soft">(19) 99999-0001</p>}
              </div>
              <div className="flex items-center gap-2">
                {!leitura && <Button variant="ghost">Transferir</Button>}
                {!leitura && <Button variant="outline">Encerrar</Button>}
                {atendimentos && <Button>Corrigir</Button>}
              </div>
            </div>
          </header>
          <div className="flex min-h-0 w-full flex-1 flex-col gap-3 px-4 py-3 md:px-[30px] md:py-[30px]">
            <div
              className={cn(
                'grid min-h-0 flex-1 gap-4',
                atendimentos
                  ? 'grid-cols-[minmax(0,1fr)_380px]'
                  : 'grid-cols-[260px_minmax(0,1fr)_320px]',
              )}
            >
              {!atendimentos && (
              <Card role="region" aria-labelledby="meus" className="min-h-0">
                <CardHeader>
                  <CardTitle id="meus">Meus chamados ({meusChamados.length})</CardTitle>
                </CardHeader>
                <nav aria-label="Meus chamados" className="flex-1 overflow-y-auto">
                  <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                    {meusChamados.map((ticket) => (
                      <li key={ticket.id}>
                        <TicketLine ticket={ticket} />
                      </li>
                    ))}
                  </ul>
                </nav>
              </Card>
              )}

              <Card role="region" aria-label="Conversa" className="relative min-h-0">
                <div
                  ref={lista}
                  className="flex-1 overflow-y-auto border-y border-line-soft bg-background px-4 py-4"
                >
                  <ol className="flex flex-col gap-2">
                    {entries.map((entry, i) => (
                      <Bubble key={`${entry.kind}-${i}`} entry={entry} modern={!atendimentos} />
                    ))}
                  </ol>
                </div>
                {atendimentos ? (
                  <div
                    role="status"
                    aria-label="Só leitura"
                    className="caption flex items-center gap-2 border-t border-line-soft bg-muted px-4 py-3 text-ink-soft"
                  >
                    <Lock strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
                    <span>
                      <span className="font-medium text-foreground">Só leitura.</span> Chamado
                      encerrado em 20/11/2026, 09:58.
                    </span>
                  </div>
                ) : leitura ? (
                  <div className="border-t border-line-soft p-3">
                    <Alert variant="warning">
                      <CircleAlert strokeWidth={1.7} aria-hidden />
                      <AlertDescription>
                        Chamado com Ana Prado. Peça a transferência para responder.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <div className="shrink-0 border-t border-line-soft p-4">
                    <div className="flex items-end gap-2">
                      <Button variant="ghost" size="icon" aria-label="Anexar arquivo">
                        <Paperclip strokeWidth={1.7} aria-hidden />
                      </Button>
                      <textarea
                        aria-label="Mensagem"
                        placeholder="Mensagem"
                        className="min-h-11 flex-1 resize-none rounded-(--radius-7) border border-input bg-card px-3 py-2.5 text-[calc(14px*var(--text-scale))] outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus"
                      />
                      <Button aria-label="Enviar mensagem">
                        <SendHorizontal strokeWidth={1.7} aria-hidden />
                        Enviar
                      </Button>
                    </div>
                  </div>
                )}
              </Card>

              {atendimentos ? (
                <Card role="region" aria-labelledby="ficha" className="min-h-0">
                  <CardHeader>
                    <CardTitle id="ficha">Atendimento</CardTitle>
                  </CardHeader>
                  <div className="flex flex-col gap-3 border-t border-line-soft px-5 py-4">
                    <div>
                      <p className="overline text-ink-faint">Contato</p>
                      <p className="body-strong">Maria Oliveira</p>
                      <p className="mono-num caption text-ink-soft">+55 (19) 99999-0001</p>
                    </div>
                    <div>
                      <p className="overline text-ink-faint">Órgão</p>
                      <p className="caption">Secretaria de Educação — Campinas</p>
                    </div>
                    <div>
                      <p className="overline text-ink-faint">Assunto</p>
                      <p className="caption">Certidão negativa indisponível</p>
                    </div>
                    <div>
                      <p className="overline text-ink-faint">Encerrado em</p>
                      <p className="caption">20/11/2026, 09:58</p>
                    </div>
                  </div>
                </Card>
              ) : (
              <Card role="region" aria-label="Fila e assuntos" className="min-h-0">
                <CardHeader>
                  <CardTitle>Fila</CardTitle>
                </CardHeader>
                <nav aria-label="Fila" className="flex-1 overflow-y-auto">
                  <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                    {fila.map((ticket) => (
                      <li key={ticket.id} className="relative">
                        <TicketLine ticket={ticket} />
                        <div className="px-4 pb-2.5">
                          <Button variant="outline" size="sm">
                            Assumir
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </nav>
              </Card>
              )}
            </div>
          </div>
        </main>
      </div>
      <Toaster theme={tema === 'escuro' ? 'dark' : 'light'} />
      {!captura && (
        <div className="fixed bottom-3 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <strong>Protótipo #325</strong>
          <span className="text-ink-soft">{titulos[cenario]}</span>
          <span className="flex items-center gap-1">
            Cenário
            <select
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={cenario}
              onChange={(e) => setCenario(e.target.value as Cenario)}
            >
              <option value="cartoes">Cartões</option>
              <option value="falha">Falha e antigos</option>
              <option value="leitura">Colega do setor</option>
              <option value="atendimentos">Atendimento encerrado</option>
            </select>
          </span>
          <label className="flex items-center gap-1">
            Tema
            <select
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={tema}
              onChange={(e) => setTema(e.target.value as Tema)}
            >
              <option value="claro">Claro</option>
              <option value="escuro">Escuro</option>
              <option value="contraste">Alto contraste</option>
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
