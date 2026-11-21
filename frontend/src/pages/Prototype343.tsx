// PROTÓTIPO #343 — descartável, não vai para a main.
// Plano: três posições da ação "Mesclar em pendente" na ficha de um atendimento
// encerrado (`/atendimentos/:id`), trocáveis por ?variante=A|B|C: junto do
// Corrigir no topo (A), dentro de um menu ⋯ (B) ou numa faixa acima da conversa (C).
// A janela "Mesclar em pendente" é a mesma nas três, e só aparece quando B está
// Encerrado ou Cancelado, o contato tem pendente no setor e a pessoa pode corrigir.
// Dados fictícios.
// Parâmetros: ?prototype=343&variante=A|B|C&estado=disponivel|sem-pendente|transferido|janela
//             &tema=claro|escuro|contraste&captura=1
import { type CSSProperties, useEffect, useState } from 'react'
import {
  ArrowRightLeft,
  Bell,
  ChevronLeft,
  CircleAlert,
  Clock,
  GitMerge,
  Menu as MenuIcon,
  MoreHorizontal,
  PencilLine,
  Settings2,
} from 'lucide-react'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// --- dados fictícios -------------------------------------------------------

type Pendente = {
  id: number
  protocolo: string
  motivo: string
  por: string
  desde: string
  tempo: string
}

const pendentesDoContato: Pendente[] = [
  {
    id: 1,
    protocolo: '2026-000118',
    motivo: 'Aguardando retorno do desenvolvimento sobre o erro no envio de anexos',
    por: 'Ana Martins',
    desde: '17/11/2026 16:20',
    tempo: 'há 3 dias',
  },
  {
    id: 3,
    protocolo: '2026-000121',
    motivo: 'Depende da liberação de acesso ao sistema pelo órgão',
    por: 'Ana Martins',
    desde: '20/11/2026 11:40',
    tempo: 'há 9 h',
  },
]

const atendimento = {
  protocolo: '2026-000125',
  contato: 'Fernanda Lima',
  telefone: '(19) 98888-2233',
  setor: 'Suporte Sistemas',
  orgao: 'Prefeitura de Hortolândia — Hortolândia',
  responsavel: 'Ana Martins',
  situacao: 'Encerrado',
  assunto: 'Certidão não emite',
  resolucao:
    'A certidão estava travada por um cadastro incompleto do imóvel. Completei o cadastro e a emissão voltou a funcionar.',
  modulos: ['Tributos'],
  chegada: '20/11/2026 09:12',
  assumido: '20/11/2026 09:30',
  encerrado: '20/11/2026 18:10',
  inicio: '20/11/2026 09:30',
  fim: '20/11/2026 18:08',
}

type Entrada =
  | { kind: 'cliente'; texto: string; at: string }
  | { kind: 'atendente'; texto: string; at: string }
  | { kind: 'aviso'; texto: string; at: string }

const conversa: Entrada[] = [
  {
    kind: 'cliente',
    texto: 'Bom dia! A certidão não está sendo emitida desde ontem.',
    at: '09:12',
  },
  {
    kind: 'atendente',
    texto: 'Bom dia, Fernanda. Vou verificar o cadastro do imóvel e já te retorno.',
    at: '09:31',
  },
  {
    kind: 'cliente',
    texto: 'Obrigada. Preciso dela para o processo de licitação até amanhã.',
    at: '09:40',
  },
  {
    kind: 'atendente',
    texto: 'Encontrei o cadastro incompleto do imóvel. Corrigi e a emissão voltou a funcionar.',
    at: '17:55',
  },
  { kind: 'aviso', texto: 'Ana Martins encerrou o chamado', at: '18:10' },
]

// --- peças -----------------------------------------------------------------

type Variante = 'A' | 'B' | 'C'
type Estado = 'disponivel' | 'sem-pendente' | 'transferido' | 'janela'
type Tema = 'claro' | 'escuro' | 'contraste'

const params = new URLSearchParams(window.location.search)
const varianteParam = (params.get('variante') ?? 'A').toUpperCase()
const varianteInicial: Variante = ['A', 'B', 'C'].includes(varianteParam)
  ? (varianteParam as Variante)
  : 'A'
const estadoParam = (params.get('estado') ?? 'disponivel') as Estado
const temaInicial = (params.get('tema') ?? 'claro') as Tema
const captura = params.get('captura') === '1'

const variantes: { value: Variante; label: string; ideia: string }[] = [
  {
    value: 'A',
    label: 'A (dois botões)',
    ideia: 'O Corrigir continua primário e "Mesclar em pendente" entra ao lado, como secundário.',
  },
  {
    value: 'B',
    label: 'B (menu ⋯)',
    ideia:
      'O Corrigir continua sozinho no topo e a ação nova fica num menu ⋯, escondida atrás de um clique.',
  },
  {
    value: 'C',
    label: 'C (faixa na conversa)',
    ideia:
      'O Corrigir continua sozinho no topo e a ação nova aparece numa faixa acima da conversa, com o motivo e o pendente do contato.',
  },
]

const titulos: Record<Estado, string> = {
  disponivel: 'Ação disponível',
  'sem-pendente': 'Contato sem pendente (ação some)',
  transferido: 'Atendimento transferido (ação some)',
  janela: 'Janela Mesclar em pendente',
}

function Conversa({ vazio }: { vazio?: boolean }) {
  return (
    <Card role="region" aria-label="Conversa" className="min-h-0">
      <div className="flex-1 overflow-y-auto border-b border-line-soft bg-background px-4 py-4">
        <ol className="flex flex-col gap-2">
          {conversa.map((entrada, i) =>
            entrada.kind === 'aviso' ? (
              <li
                key={`aviso-${i}`}
                className="caption flex max-w-full items-start gap-1.5 self-center rounded-(--radius-7) border border-dashed border-line px-2.5 py-1 text-ink-soft"
              >
                <Clock strokeWidth={1.7} aria-hidden className="size-[15px] shrink-0" />
                <span className="min-w-0">
                  {entrada.texto} · <span className="mono-num whitespace-nowrap">{entrada.at}</span>
                </span>
              </li>
            ) : (
              <li
                key={`${entrada.kind}-${i}`}
                className={cn(
                  'max-w-[78%] rounded-(--radius-12) border px-3 py-2',
                  entrada.kind === 'atendente'
                    ? 'self-end rounded-br-(--radius-6) border-primary bg-primary text-primary-foreground'
                    : 'self-start rounded-bl-(--radius-6) border-line bg-card',
                )}
              >
                <p className="whitespace-pre-wrap break-words">{entrada.texto}</p>
                <p
                  className={cn(
                    'mono-num caption mt-1 text-right',
                    entrada.kind === 'atendente' ? 'text-primary-foreground' : 'text-ink-soft',
                  )}
                >
                  {entrada.at}
                </p>
              </li>
            ),
          )}
        </ol>
      </div>
      {vazio && <div className="min-h-0 flex-1" />}
      <div className="caption flex shrink-0 items-center gap-2 px-4 py-3 text-ink-soft">
        <Clock strokeWidth={1.7} aria-hidden className="size-[15px] shrink-0" />
        Somente leitura. Atendimento encerrado; use Corrigir para mudar os dados.
      </div>
    </Card>
  )
}

function Detalhes({ situacao }: { situacao: string }) {
  const row = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="label text-ink-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
  return (
    <dl className="flex flex-col gap-3">
      {row('Protocolo', <span className="mono-num">{atendimento.protocolo}</span>)}
      {row(
        'Situação',
        <Badge tone={situacao === 'Mesclado' ? 'neutral' : 'success'}>{situacao}</Badge>,
      )}
      {row('Setor', atendimento.setor)}
      {row('Contato', atendimento.contato)}
      {row('Órgão', atendimento.orgao)}
      {row('Responsável', atendimento.responsavel)}
      {row('Chegada', <span className="mono-num">{atendimento.chegada}</span>)}
      {row('Encerrado em', <span className="mono-num">{atendimento.encerrado}</span>)}
      {row('Assunto', atendimento.assunto)}
      {row(
        'Resolução',
        <span className="whitespace-pre-wrap break-words">{atendimento.resolucao}</span>,
      )}
      {row(
        'Módulos',
        <span className="flex flex-wrap gap-1">
          {atendimento.modulos.map((modulo) => (
            <Badge key={modulo} variant="tag">
              {modulo}
            </Badge>
          ))}
        </span>,
      )}
      <div className="grid grid-cols-2 gap-3">
        {row('Início', <span className="mono-num">{atendimento.inicio}</span>)}
        {row('Fim', <span className="mono-num">{atendimento.fim}</span>)}
      </div>
    </dl>
  )
}

// Janela "Mesclar em pendente": a mesma nas três versões.
function JanelaMesclar({ aoFechar }: { aoFechar: () => void }) {
  const [escolhido, setEscolhido] = useState(pendentesDoContato[0].id)
  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(aberto, detalhes) => {
        if (aberto) return
        if (detalhes.reason === 'escape-key' || detalhes.reason === 'outside-press') {
          detalhes.cancel()
          return
        }
        aoFechar()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Mesclar em pendente</DialogTitle>
          <DialogDescription>
            As mensagens deste atendimento passam para o pendente escolhido, que fica com a situação
            e os dados do encerramento. Este atendimento fica registrado como Mesclado.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px]">
          <fieldset className="flex flex-col gap-2">
            <legend className="label mb-1 text-ink-soft">Chamado pendente deste contato</legend>
            {pendentesDoContato.map((pendente) => (
              <label
                key={pendente.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-(--radius-9) border border-line px-3 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-accent-soft"
              >
                <input
                  type="radio"
                  name="pendente-escolhido"
                  className="mt-1 size-4 shrink-0 accent-(--accent)"
                  checked={escolhido === pendente.id}
                  onChange={() => setEscolhido(pendente.id)}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="mono-num body-strong">{pendente.protocolo}</span>
                  </span>
                  <span className="caption text-ink">{pendente.motivo}</span>
                  <span className="caption text-ink-faint">
                    por {pendente.por} · {pendente.tempo}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
          <Button type="button">
            <GitMerge strokeWidth={1.7} aria-hidden />
            Mesclar em pendente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- tela ------------------------------------------------------------------

export default function Prototype343() {
  const [variante, setVariante] = useState<Variante>(varianteInicial)
  const [estado, setEstado] = useState<Estado>(estadoParam)
  const [tema, setTema] = useState<Tema>(temaInicial)
  const [janela, setJanela] = useState(estadoParam === 'janela')
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = tema === 'contraste' ? 'high' : 'normal'
  }, [tema])

  const aplicar = (proximo: Estado) => {
    setEstado(proximo)
    setJanela(proximo === 'janela')
    setMenu(false)
  }

  const situacao = estado === 'transferido' ? 'Transferido' : atendimento.situacao
  const existePendente = estado !== 'sem-pendente'
  const podeCorrigir = estado !== 'transferido'
  // A ação só aparece: B encerrado ou cancelado, quem pode corrigir e contato com pendente.
  const podeMesclar = podeCorrigir && existePendente
  const abrir = () => setJanela(true)

  const doisBotoes = (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={abrir}>
        <GitMerge strokeWidth={1.7} aria-hidden />
        Mesclar em pendente
      </Button>
      <Button>
        <PencilLine strokeWidth={1.7} aria-hidden />
        Corrigir
      </Button>
    </div>
  )

  const corrigirSozinho = (
    <div className="flex items-center gap-2">
      <Button>
        <PencilLine strokeWidth={1.7} aria-hidden />
        Corrigir
      </Button>
      {variante === 'B' && podeMesclar && (
        <DropdownMenuFalso aberto={menu} aoAbrir={setMenu} aoEscolher={abrir} />
      )}
    </div>
  )

  const faixaMesclar = podeMesclar && (
    <div className="shrink-0 border-b border-line-soft bg-background px-4 py-2 md:px-[30px]">
      <Alert variant="warning">
        <GitMerge strokeWidth={1.7} aria-hidden />
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Este contato tem {pendentesDoContato.length}{' '}
            {pendentesDoContato.length === 1 ? 'chamado pendente' : 'chamados pendentes'}. Se este
            atendimento era a continuação dele, mescle em vez de corrigir.
          </span>
          <Button variant="outline" size="sm" onClick={abrir}>
            Mesclar em pendente
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )

  return (
    <div
      className="flex h-dvh flex-col bg-background text-foreground"
      style={{ '--header-height': '3.5rem' } as CSSProperties}
    >
      <header className="flex h-(--header-height) shrink-0 items-center justify-between border-b border-line bg-card px-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
            <MenuIcon strokeWidth={1.7} aria-hidden />
          </Button>
          <img src={tema === 'escuro' ? symbolDark : symbol} alt="" className="h-8 w-8" />
          <div>
            <p className="body-strong leading-tight">GCASPP LAB</p>
            <p className="caption text-ink-soft">Central de Atendimento</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Notificações">
            <Bell strokeWidth={1.7} aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Configurações">
            <Settings2 strokeWidth={1.7} aria-hidden />
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-(--sidebar-width) shrink-0 flex-col gap-1 border-r border-line bg-card px-3 py-4 text-sm md:flex">
          <p className="overline px-2 pb-1 text-ink-faint">Helpdesk</p>
          <p className="px-2 py-2">Chamados</p>
          <p className="rounded-(--radius-7) bg-accent-soft px-2 py-2 font-medium text-accent-strong">
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
              <Button variant="ghost" size="icon" aria-label="Voltar">
                <ChevronLeft strokeWidth={1.7} aria-hidden />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="caption truncate text-ink-faint">
                  Atendimentos · {atendimento.setor} · {atendimento.protocolo}
                </p>
                <h1 className="title-page truncate">{atendimento.contato}</h1>
                <p className="caption text-ink-soft">{atendimento.telefone}</p>
              </div>
              {!podeCorrigir ? null : variante === 'A' && podeMesclar ? (
                doisBotoes
              ) : variante === 'A' ? (
                <Button variant="outline">
                  <PencilLine strokeWidth={1.7} aria-hidden />
                  Corrigir
                </Button>
              ) : (
                corrigirSozinho
              )}
            </div>
          </header>
          <div className="shrink-0 border-b border-warning/40 bg-warning-soft px-4 py-2 text-warning-ink md:px-[30px]">
            <p className="caption flex items-center gap-1.5">
              <CircleAlert strokeWidth={1.7} aria-hidden className="size-[15px] shrink-0" />
              {estado === 'transferido'
                ? `Transferido para outro setor em ${atendimento.encerrado} por ${atendimento.responsavel}.`
                : `Encerrado em ${atendimento.encerrado} por ${atendimento.responsavel}.`}
            </p>
          </div>
          {variante === 'C' && faixaMesclar}
          <div className="grid min-h-0 w-full flex-1 grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 md:px-[30px] md:py-[30px] lg:grid-cols-[minmax(0,1fr)_380px]">
            <Conversa />
            <Card role="region" aria-labelledby="ticket-info-title" className="min-h-0">
              <CardHeader>
                <CardTitle id="ticket-info-title">Atendimento</CardTitle>
              </CardHeader>
              <Tabs value="details" className="min-h-0 flex-1 px-5 pb-5">
                <TabsList>
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                  <TabsTrigger value="history">Histórico</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="min-h-0 overflow-y-auto">
                  <Detalhes situacao={situacao} />
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </main>
      </div>

      {janela && podeMesclar && <JanelaMesclar aoFechar={() => setJanela(false)} />}

      {!captura && (
        <div className="fixed bottom-3 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <strong>Protótipo #343</strong>
          <span className="text-ink-soft">{titulos[estado]}</span>
          <span className="flex items-center gap-1">
            Versão
            <select
              aria-label="Versão"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={variante}
              onChange={(event) => setVariante(event.target.value as Variante)}
            >
              {variantes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </span>
          <span className="flex items-center gap-1">
            Estado
            <select
              aria-label="Estado"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={estado}
              onChange={(event) => aplicar(event.target.value as Estado)}
            >
              <option value="disponivel">Ação disponível</option>
              <option value="sem-pendente">Contato sem pendente</option>
              <option value="transferido">Atendimento transferido</option>
              <option value="janela">Janela</option>
            </select>
          </span>
          <span className="flex items-center gap-1">
            Tema
            <select
              aria-label="Tema"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={tema}
              onChange={(event) => setTema(event.target.value as Tema)}
            >
              <option value="claro">Claro</option>
              <option value="escuro">Escuro</option>
              <option value="contraste">Contraste</option>
            </select>
          </span>
        </div>
      )}
    </div>
  )
}

// Menu ⋯ da versão B, só com a ação nova (o resto do menu não muda nesta tarefa).
function DropdownMenuFalso({
  aberto,
  aoAbrir,
  aoEscolher,
}: {
  aberto: boolean
  aoAbrir: (aberto: boolean) => void
  aoEscolher: () => void
}) {
  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label="Mais ações"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => aoAbrir(!aberto)}
      >
        <MoreHorizontal strokeWidth={1.7} aria-hidden />
      </Button>
      {aberto && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 min-w-56 rounded-(--radius-9) border border-line bg-popover p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-(--radius-7) px-2.5 py-2 text-left text-sm hover:bg-muted"
            onClick={aoEscolher}
          >
            <GitMerge strokeWidth={1.7} aria-hidden />
            Mesclar em pendente
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-(--radius-7) px-2.5 py-2 text-left text-sm hover:bg-muted"
          >
            <ArrowRightLeft strokeWidth={1.7} aria-hidden />
            Ver histórico do contato
          </button>
        </div>
      )}
    </div>
  )
}
