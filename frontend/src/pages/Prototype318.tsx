// PROTÓTIPO #318 — descartável, não vai para a main.
// Plano: uma versão do Dashboard (ajuste de tela existente) com o filtro novo
// Canal (Todos, WhatsApp, Telefone) e "Não se aplica ao filtro" nos números em
// que o canal não vale. Estado pelo endereço: ?canal=todos|whatsapp|telefone,
// com ?tema=claro|escuro|contraste e ?captura=1 (esconde a barra). Dados fictícios.
import { BarChart3, Bell, ChevronDown, ChevronUp } from 'lucide-react'
import { type CSSProperties, useEffect, useId, useState, type ReactNode } from 'react'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import { KpiCard } from '@/components/KpiCard'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

const notApplicable = 'Não se aplica ao filtro'
const noDataMark = '—'

type Tema = 'claro' | 'escuro' | 'contraste'
type Canal = 'todos' | 'whatsapp' | 'telefone'
type Numero = { applicable: boolean; value: number | null }
type Linha = {
  pessoa: string
  setor: string
  inProgress: Numero
  started: Numero
  resolved: Numero
  transferred: Numero
  cancelled: Numero
  averageHandlingSeconds: Numero
}

const params = new URLSearchParams(window.location.search)
const temaParam = (params.get('tema') ?? 'claro') as Tema
const captura = params.get('captura') === '1'

const canalParam = (params.get('canal') ?? 'todos') as Canal
const canalInicial: Canal = ['todos', 'whatsapp', 'telefone'].includes(canalParam)
  ? canalParam
  : 'todos'

const canais: { value: Canal; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telefone', label: 'Telefone' },
]

const numerosPorCanal: Record<Canal, Record<string, Numero>> = {
  todos: {
    queued: { applicable: true, value: 3 },
    inProgress: { applicable: true, value: 4 },
    received: { applicable: true, value: 42 },
    started: { applicable: true, value: 5 },
    resolved: { applicable: true, value: 38 },
    transferred: { applicable: true, value: 2 },
    cancelled: { applicable: true, value: 1 },
    averageWaitSeconds: { applicable: true, value: 520 },
    averageHandlingSeconds: { applicable: true, value: 1440 },
  },
  // Com o canal ativo, só valem Encerrados, Transferidos, Cancelados e os tempos
  // de atendimento; os demais aparecem como "Não se aplica ao filtro".
  whatsapp: {
    queued: { applicable: false, value: null },
    inProgress: { applicable: false, value: null },
    received: { applicable: false, value: null },
    started: { applicable: false, value: null },
    resolved: { applicable: true, value: 31 },
    transferred: { applicable: true, value: 2 },
    cancelled: { applicable: true, value: 1 },
    averageWaitSeconds: { applicable: false, value: null },
    averageHandlingSeconds: { applicable: true, value: 1320 },
  },
  telefone: {
    queued: { applicable: false, value: null },
    inProgress: { applicable: false, value: null },
    received: { applicable: false, value: null },
    started: { applicable: false, value: null },
    resolved: { applicable: true, value: 7 },
    transferred: { applicable: true, value: 0 },
    cancelled: { applicable: true, value: 0 },
    averageWaitSeconds: { applicable: false, value: null },
    averageHandlingSeconds: { applicable: true, value: 1860 },
  },
}

const nao: Numero = { applicable: false, value: null }
const contar = (quantidade: number): Numero => ({ applicable: true, value: quantidade })
const segundos = (quantidade: number): Numero => ({ applicable: true, value: quantidade })

const linhasPorCanal: Record<Canal, Linha[]> = {
  todos: [
    {
      pessoa: 'Ana Prado',
      setor: 'Suporte Sistemas',
      inProgress: contar(1),
      started: contar(2),
      resolved: contar(14),
      transferred: contar(1),
      cancelled: contar(0),
      averageHandlingSeconds: segundos(1260),
    },
    {
      pessoa: 'Bruno Salles',
      setor: 'Tributos Municipais',
      inProgress: contar(2),
      started: contar(1),
      resolved: contar(11),
      transferred: contar(1),
      cancelled: contar(1),
      averageHandlingSeconds: segundos(1620),
    },
    {
      pessoa: 'Carla Dias',
      setor: 'Suporte Sistemas',
      inProgress: contar(1),
      started: contar(2),
      resolved: contar(9),
      transferred: contar(0),
      cancelled: contar(0),
      averageHandlingSeconds: segundos(1440),
    },
    {
      pessoa: 'Diego Matos',
      setor: 'Protocolo Geral',
      inProgress: contar(0),
      started: contar(0),
      resolved: contar(4),
      transferred: contar(0),
      cancelled: contar(0),
      averageHandlingSeconds: segundos(1560),
    },
  ],
  whatsapp: [
    {
      pessoa: 'Ana Prado',
      setor: 'Suporte Sistemas',
      inProgress: nao,
      started: nao,
      resolved: contar(10),
      transferred: contar(1),
      cancelled: contar(0),
      averageHandlingSeconds: segundos(1140),
    },
    {
      pessoa: 'Bruno Salles',
      setor: 'Tributos Municipais',
      inProgress: nao,
      started: nao,
      resolved: contar(9),
      transferred: contar(1),
      cancelled: contar(1),
      averageHandlingSeconds: segundos(1500),
    },
    {
      pessoa: 'Carla Dias',
      setor: 'Suporte Sistemas',
      inProgress: nao,
      started: nao,
      resolved: contar(8),
      transferred: contar(0),
      cancelled: contar(0),
      averageHandlingSeconds: segundos(1380),
    },
    {
      pessoa: 'Diego Matos',
      setor: 'Protocolo Geral',
      inProgress: nao,
      started: nao,
      resolved: contar(4),
      transferred: contar(0),
      cancelled: contar(0),
      averageHandlingSeconds: segundos(1560),
    },
  ],
  // Só quem tem registro por telefone aparece; o tempo vai do início ao fim da ligação.
  telefone: [
    {
      pessoa: 'Ana Prado',
      setor: 'Suporte Sistemas',
      inProgress: nao,
      started: nao,
      resolved: contar(4),
      transferred: contar(0),
      cancelled: contar(0),
      averageHandlingSeconds: segundos(1560),
    },
    {
      pessoa: 'Carla Dias',
      setor: 'Suporte Sistemas',
      inProgress: nao,
      started: nao,
      resolved: contar(3),
      transferred: contar(0),
      cancelled: contar(0),
      averageHandlingSeconds: segundos(2220),
    },
  ],
}

type Formato = (value: number) => string
const comoContagem: Formato = String

function formatarTempo(value: number) {
  const minutos = Math.floor(value / 60)
  const resto = value % 60
  if (minutos === 0) return `${resto}s`
  return resto === 0 ? `${minutos}min` : `${minutos}min ${resto}s`
}

function exibir(numero: Numero, format: Formato) {
  return numero.applicable && numero.value !== null ? format(numero.value) : noDataMark
}

function Kpi({
  label,
  number,
  format = comoContagem,
}: {
  label: string
  number: Numero
  format?: Formato
}) {
  return (
    <KpiCard
      label={label}
      value={exibir(number, format)}
      hint={!number.applicable ? notApplicable : undefined}
    />
  )
}

const periodos = ['Hoje', '7 dias', '30 dias', 'Datas']

const setores = ['Todos os setores', 'Suporte Sistemas', 'Tributos Municipais', 'Protocolo Geral']
const atendentes = ['Todos os atendentes', 'Ana Prado', 'Bruno Salles', 'Carla Dias', 'Diego Matos']
const modulos = ['Todos os módulos', 'Portal do Cidadão', 'Tributos', 'Protocolo']
const orgaos = [
  'Todos os órgãos',
  'Prefeitura Municipal de Serra Azul · Serra Azul',
  'Câmara Municipal de Vila Nova · Vila Nova',
  'Secretaria de Educação de Serra Azul · Serra Azul',
]

function Campo({
  id,
  label,
  options,
  width = 200,
}: {
  id: string
  label: string
  options: string[]
  width?: number
}) {
  const [value, setValue] = useState(options[0])
  return (
    <Field className="w-full" style={{ maxWidth: `calc(${width}px*var(--text-scale))` }}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={options.map((option) => ({ value: option, label: option }))}
        value={value}
        onValueChange={(next) => next && setValue(next)}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

// O filtro novo, com o estado vindo do protótipo.
function FiltroCanal({ canal, setCanal }: { canal: Canal; setCanal: (canal: Canal) => void }) {
  const items = [
    { value: 'todos', label: 'Todos os canais' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'telefone', label: 'Telefone' },
  ]
  return (
    <Field className="w-full" style={{ maxWidth: 'calc(190px*var(--text-scale))' }}>
      <FieldLabel htmlFor="dashboard-canal">Canal</FieldLabel>
      <Select items={items} value={canal} onValueChange={(next) => next && setCanal(next as Canal)}>
        <SelectTrigger id="dashboard-canal">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function SecaoKpi({
  title,
  detail,
  children,
  inicialAberta = true,
}: {
  title: string
  detail?: string
  children: ReactNode
  inicialAberta?: boolean
}) {
  const id = useId()
  const [collapsed, setCollapsed] = useState(!inicialAberta)
  const Icon = collapsed ? ChevronDown : ChevronUp
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-2">
        <h2 id={id} className="title-panel">
          {title}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Abrir' : 'Recolher'} ${title}`}
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon strokeWidth={1.7} aria-hidden />
        </Button>
        {detail && <p className="caption mono-num text-ink-faint">{detail}</p>}
      </div>
      {!collapsed && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,calc(170px*var(--text-scale))),1fr))] gap-3">
          {children}
        </div>
      )}
    </section>
  )
}

const colunas: {
  key: Exclude<keyof Linha, 'pessoa' | 'setor'>
  label: string
  format: Formato
}[] = [
  { key: 'inProgress', label: 'Em atendimento', format: comoContagem },
  { key: 'started', label: 'Iniciados', format: comoContagem },
  { key: 'resolved', label: 'Encerrados', format: comoContagem },
  { key: 'transferred', label: 'Transferidos', format: comoContagem },
  { key: 'cancelled', label: 'Cancelados', format: comoContagem },
  { key: 'averageHandlingSeconds', label: 'Tempo médio de atendimento', format: formatarTempo },
]

const listFormat = new Intl.ListFormat('pt-BR')

function CardAtendentes({ linhas }: { linhas: Linha[] }) {
  const excluded = colunas.filter((coluna) => linhas.some((linha) => !linha[coluna.key].applicable))
  return (
    <Card id="prototype-318-tabela" role="region" aria-labelledby="dashboard-assignees-title">
      <CardHeader>
        <CardTitle id="dashboard-assignees-title">Por atendente</CardTitle>
      </CardHeader>
      {linhas.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atendente</TableHead>
                <TableHead>Setor</TableHead>
                {colunas.map((coluna) => (
                  <TableHead key={coluna.key} className="text-right">
                    {coluna.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((linha) => (
                <TableRow key={linha.pessoa}>
                  <TableCell className="body-strong">{linha.pessoa}</TableCell>
                  <TableCell>{linha.setor}</TableCell>
                  {colunas.map((coluna) => (
                    <TableCell key={coluna.key} className="mono-num text-right">
                      {exibir(linha[coluna.key], coluna.format)}
                      {!linha[coluna.key].applicable && (
                        <span className="sr-only"> {notApplicable}</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {excluded.length > 0 && (
            <p className="caption border-t border-line-soft px-5 py-3 text-ink-faint">
              {notApplicable}: {listFormat.format(excluded.map((coluna) => coluna.label))}.
            </p>
          )}
        </>
      ) : (
        <Empty>
          <EmptyMedia>
            <BarChart3 strokeWidth={1.7} aria-hidden />
          </EmptyMedia>
          <EmptyDescription>Nenhum atendente com números nestes filtros.</EmptyDescription>
        </Empty>
      )}
    </Card>
  )
}

const rotulosCanal: Record<Canal, string> = {
  todos: 'Todos os canais (padrão)',
  whatsapp: 'Canal WhatsApp: só os números do WhatsApp',
  telefone: 'Canal Telefone: só os registros por telefone',
}

export default function Prototype318() {
  const [canal, setCanalState] = useState<Canal>(canalInicial)
  const [tema, setTema] = useState<Tema>(temaParam)
  const [periodo, setPeriodo] = useState('Hoje')

  function setCanal(next: Canal) {
    setCanalState(next)
    const url = new URL(window.location.href)
    if (next === 'todos') url.searchParams.delete('canal')
    else url.searchParams.set('canal', next)
    window.history.replaceState(null, '', url)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = tema === 'contraste' ? 'high' : 'normal'
  }, [tema])

  // Capturas: ?rolar=tabela abre com a tabela por atendente no campo de visão.
  useEffect(() => {
    if (params.get('rolar') === 'tabela') {
      window.setTimeout(() => {
        document.getElementById('prototype-318-tabela')?.scrollIntoView({ block: 'start' })
      }, 200)
    }
  }, [])

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const alvo = evento.target as HTMLElement | null
      if (
        alvo &&
        (alvo.tagName === 'INPUT' ||
          alvo.tagName === 'TEXTAREA' ||
          alvo.isContentEditable ||
          alvo.closest('[role="listbox"]'))
      ) {
        return
      }
      const atual = canais.findIndex((item) => item.value === canal)
      if (evento.key === 'ArrowLeft')
        setCanal(canais[(atual - 1 + canais.length) % canais.length].value)
      if (evento.key === 'ArrowRight') setCanal(canais[(atual + 1) % canais.length].value)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  const numbers = numerosPorCanal[canal]
  const linhas = linhasPorCanal[canal]

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
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
          <p className="px-2 py-2">Chamados</p>
          <p className="px-2 py-2">Atendimentos</p>
          <p className="rounded-(--radius-7) bg-accent-soft px-2 py-2 font-medium text-accent-strong">
            Dashboard
          </p>
          <p className="px-2 py-2">Contatos</p>
          <p className="px-2 py-2">Conexão</p>
          <p className="overline px-2 pt-6 pb-1 text-ink-faint">Cadastro</p>
          <p className="px-2 py-2">Órgãos</p>
          <p className="px-2 py-2">Módulos</p>
          <p className="px-2 py-2">Assuntos</p>
          <p className="px-2 py-2">Setores</p>
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <header className="shrink-0 border-b border-line-soft bg-background">
            <div className="mx-auto flex max-w-(--content-max) flex-wrap items-center gap-3 px-4 py-3 md:px-[30px]">
              <div className="min-w-0 flex-1">
                <p className="caption text-ink-faint">Helpdesk</p>
                <h1 className="title-page truncate">Dashboard</h1>
              </div>
            </div>
          </header>
          <div className="mx-auto flex w-full max-w-(--content-max) flex-col gap-4 px-4 py-4 md:px-[30px] md:py-[30px]">
            <div className="flex flex-col gap-3">
              <ToggleGroup
                aria-label="Período"
                value={[periodo]}
                onValueChange={(values: string[]) => {
                  const [value] = values
                  if (value) setPeriodo(value)
                }}
              >
                {periodos.map((choice) => (
                  <ToggleGroupItem key={choice} value={choice}>
                    {choice}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="flex flex-wrap items-start gap-3">
                <Campo id="dashboard-sector" label="Setor" options={setores} width={200} />
                <FiltroCanal canal={canal} setCanal={setCanal} />
                <Campo id="dashboard-assignee" label="Atendente" options={atendentes} width={200} />
                <Campo id="dashboard-module" label="Módulo" options={modulos} width={200} />
                <Campo id="dashboard-organization" label="Órgão" options={orgaos} width={260} />
              </div>
            </div>

            <SecaoKpi title="Agora">
              <Kpi label="Na fila" number={numbers.queued} />
              <Kpi label="Em atendimento" number={numbers.inProgress} />
            </SecaoKpi>

            <SecaoKpi title="No período" detail="20/11/2026">
              <Kpi label="Recebidos" number={numbers.received} />
              <Kpi label="Iniciados" number={numbers.started} />
              <Kpi label="Encerrados" number={numbers.resolved} />
              <Kpi label="Transferidos" number={numbers.transferred} />
              <Kpi label="Cancelados" number={numbers.cancelled} />
              <Kpi
                label="Tempo médio de espera"
                number={numbers.averageWaitSeconds}
                format={formatarTempo}
              />
              <Kpi
                label="Tempo médio de atendimento"
                number={numbers.averageHandlingSeconds}
                format={formatarTempo}
              />
            </SecaoKpi>

            <CardAtendentes linhas={linhas} />
          </div>
        </main>
      </div>

      {!captura && (
        <div className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <strong className="px-1">Protótipo #318</strong>
          <ToggleGroup
            aria-label="Canal do protótipo"
            value={[canal]}
            onValueChange={(values: string[]) => {
              const [value] = values
              if (value) setCanal(value as Canal)
            }}
          >
            {canais.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <span className="mx-1 h-5 w-px bg-line" />
          <span className="max-w-[260px] px-1 text-ink-soft">{rotulosCanal[canal]}</span>
          <label className="ml-1 flex items-center gap-1">
            Tema
            <select
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={tema}
              onChange={(evento) => setTema(evento.target.value as Tema)}
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
