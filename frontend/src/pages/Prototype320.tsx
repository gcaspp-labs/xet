// PROTÓTIPO #320 — descartável, não vai para a main.
// Plano: uma proposta para a marca Telefone, o filtro Canal e o detalhe sem conversa,
// em três telas trocáveis por ?tela=: a lista de Atendimentos, a ficha do registro por
// telefone e a aba Histórico dela. Dados fictícios.
//   ?prototype=320&tela=lista|detalhe|historico&canal=todos|whatsapp|telefone
//   &tema=claro|escuro|contraste&captura=1
import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bell, Inbox, PencilLine, Phone } from 'lucide-react'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import { SearchBox } from '@/components/SearchBox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type Tela = 'lista' | 'detalhe' | 'historico'
type Tema = 'claro' | 'escuro' | 'contraste'
type Canal = 'whatsapp' | 'telefone'

type Registro = {
  id: number
  protocol: string
  closedAt: string
  contact: { name: string; phone: string }
  organization: string
  municipality: string
  assignee: string
  subject: string
  modules: string[]
  closureType: 'resolved' | 'transferred' | 'cancelled'
  channel: Canal
  transferredTo?: string
  startedAt?: string
  endedAt?: string
}

// Dados fictícios: 5 pelo WhatsApp (como hoje) e 3 por telefone (o que a #316 cria).
const registros: Registro[] = [
  {
    id: 131,
    protocol: '2026-000131',
    closedAt: '2026-11-20T16:04:00-03:00',
    contact: { name: 'Maria Oliveira', phone: '11987654321' },
    organization: 'Prefeitura Municipal de São Paulo',
    municipality: 'São Paulo',
    assignee: 'Ana Souza',
    subject: 'Contracheque não disponível',
    modules: ['Folha de pagamento'],
    closureType: 'resolved',
    channel: 'whatsapp',
  },
  {
    id: 130,
    protocol: '2026-000130',
    closedAt: '2026-11-20T15:42:00-03:00',
    contact: { name: 'João da Silva', phone: '11991234567' },
    organization: 'Secretaria de Educação',
    municipality: 'Guarulhos',
    assignee: 'Ana Souza',
    subject: 'Erro ao anexar documento',
    modules: ['Documentos', 'Cadastro'],
    closureType: 'resolved',
    channel: 'telefone',
    startedAt: '2026-11-20T15:12:00-03:00',
    endedAt: '2026-11-20T15:38:00-03:00',
  },
  {
    id: 129,
    protocol: '2026-000129',
    closedAt: '2026-11-20T15:20:00-03:00',
    contact: { name: 'Fernanda Lima', phone: '11999887766' },
    organization: 'Câmara Municipal de Osasco',
    municipality: 'Osasco',
    assignee: 'Bruno Ramos',
    subject: 'Pedido de segunda via',
    modules: ['Cadastro'],
    closureType: 'transferred',
    channel: 'whatsapp',
    transferredTo: 'Financeiro',
  },
  {
    id: 128,
    protocol: '2026-000128',
    closedAt: '2026-11-20T14:55:00-03:00',
    contact: { name: 'Carlos Pereira', phone: '11988776655' },
    organization: 'Prefeitura Municipal de São Paulo',
    municipality: 'São Paulo',
    assignee: 'Bruno Ramos',
    subject: 'Boleto atualizado',
    modules: ['Financeiro'],
    closureType: 'resolved',
    channel: 'telefone',
    startedAt: '2026-11-20T14:31:00-03:00',
    endedAt: '2026-11-20T14:52:00-03:00',
  },
  {
    id: 127,
    protocol: '2026-000127',
    closedAt: '2026-11-20T14:30:00-03:00',
    contact: { name: 'Ana Beatriz Souza', phone: '11977665544' },
    organization: 'Secretaria de Saúde',
    municipality: 'São Bernardo do Campo',
    assignee: 'Ana Souza',
    subject: 'Agendamento de vistoria',
    modules: ['Agenda'],
    closureType: 'resolved',
    channel: 'whatsapp',
  },
  {
    id: 126,
    protocol: '2026-000126',
    closedAt: '2026-11-20T13:58:00-03:00',
    contact: { name: 'Roberto Nunes', phone: '11966554433' },
    organization: 'Secretaria de Obras',
    municipality: 'Diadema',
    assignee: 'Carla Mendes',
    subject: 'Protocolo não reconhecido',
    modules: ['Atendimento'],
    closureType: 'cancelled',
    channel: 'whatsapp',
  },
  {
    id: 125,
    protocol: '2026-000125',
    closedAt: '2026-11-20T13:20:00-03:00',
    contact: { name: 'Patrícia Gomes', phone: '11955443322' },
    organization: 'Câmara Municipal de Osasco',
    municipality: 'Osasco',
    assignee: 'Carla Mendes',
    subject: 'Orientações sobre o cadastro',
    modules: ['Cadastro', 'Atendimento'],
    closureType: 'resolved',
    channel: 'telefone',
    startedAt: '2026-11-20T13:02:00-03:00',
    endedAt: '2026-11-20T13:17:00-03:00',
  },
  {
    id: 124,
    protocol: '2026-000124',
    closedAt: '2026-11-20T12:40:00-03:00',
    contact: { name: 'Marcos Almeida', phone: '11944332211' },
    organization: 'Secretaria de Educação',
    municipality: 'Guarulhos',
    assignee: 'Bruno Ramos',
    subject: 'CPF não aceito no login',
    modules: ['Acesso'],
    closureType: 'resolved',
    channel: 'whatsapp',
  },
]

const registroTelefone = registros.find((registro) => registro.channel === 'telefone')!

// O mesmo formato da tela: data e hora no horário de Brasília, "Hoje" para o dia atual.
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
})
const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' })

function formatClosedAt(value: string) {
  const moment = new Date(value)
  const day =
    dayFormat.format(moment) === dayFormat.format(new Date()) ? 'Hoje' : dateFormat.format(moment)
  return `${day} ${timeFormat.format(moment)}`
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formatDateTime(value: string) {
  return `${dateFormat.format(new Date(value))} ${timeFormat.format(new Date(value))}`
}

// A marca do canal: só o Telefone aparece, como pede a spec (regra 10 de queue.md).
// Tag do design system, com o ícone de telefone: é categoria, não situação.
function MarcaTelefone() {
  return (
    <Badge variant="tag" className="gap-1">
      <Phone strokeWidth={1.7} aria-hidden className="size-3" />
      Telefone
    </Badge>
  )
}

function SituationCell({ registro }: { registro: Registro }) {
  const type = registro.closureType
  return (
    <span className="flex flex-col items-start gap-(--space-4)">
      <Badge tone={type === 'cancelled' ? 'danger' : 'neutral'}>
        {type === 'resolved' ? 'Encerrado' : type === 'transferred' ? 'Transferido' : 'Cancelado'}
      </Badge>
      {registro.channel === 'telefone' && <MarcaTelefone />}
      {registro.transferredTo && (
        <span className="caption text-ink-faint">para {registro.transferredTo}</span>
      )}
    </span>
  )
}

function ModulesCell({ modules }: { modules: string[] }) {
  return modules.length > 0 ? (
    <span className="flex max-w-[105px] flex-col gap-(--space-4)">
      {modules.map((module) => (
        <Badge key={module} variant="tag" className="block max-w-full truncate" title={module}>
          {module}
        </Badge>
      ))}
    </span>
  ) : (
    <span className="text-ink-faint">—</span>
  )
}

function TicketRow({ registro }: { registro: Registro }) {
  return (
    <TableRow className="relative">
      <TableCell className="mono-num caption whitespace-nowrap">
        <span className="body-strong underline-offset-2">{registro.protocol}</span>
      </TableCell>
      <TableCell className="mono-num caption whitespace-nowrap">
        {formatClosedAt(registro.closedAt)}
      </TableCell>
      <TableCell className="max-w-[120px]">
        <p className="truncate" title={registro.contact.name}>
          {registro.contact.name}
        </p>
        <p className="mono-num caption text-ink-faint">{formatPhone(registro.contact.phone)}</p>
      </TableCell>
      <TableCell className="max-w-[110px] truncate" title={registro.organization}>
        {registro.organization}
      </TableCell>
      <TableCell className="max-w-[100px] truncate">{registro.assignee}</TableCell>
      <TableCell className="max-w-[110px] truncate">{registro.subject}</TableCell>
      <TableCell>
        <ModulesCell modules={registro.modules} />
      </TableCell>
      <TableCell>
        <SituationCell registro={registro} />
      </TableCell>
    </TableRow>
  )
}

function Overline({ children }: { children: string }) {
  return <h3 className="overline text-ink-soft">{children}</h3>
}

function Filters({
  query,
  onQuery,
  canal,
  onCanal,
  contagem,
}: {
  query: string
  onQuery: (value: string) => void
  canal: Canal | 'todos'
  onCanal: (value: Canal | 'todos') => void
  contagem: number
}) {
  const periodos = [
    { value: 'all', label: 'Todo o período' },
    { value: 'today', label: 'Hoje' },
    { value: '7d', label: '7 dias' },
    { value: '30d', label: '30 dias' },
    { value: 'custom', label: 'Datas' },
  ]
  return (
    <div className="flex max-h-[45%] min-h-0 shrink-0 flex-col gap-(--space-12)">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-(--space-12)">
        <SearchBox
          value={query}
          onChange={onQuery}
          label="Buscar chamados"
          placeholder="Protocolo, contato, telefone ou órgão"
        />
        <ToggleGroup aria-label="Período" value={['all']} onValueChange={() => {}}>
          {periodos.map((choice) => (
            <ToggleGroupItem key={choice.value} value={choice.value}>
              {choice.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex min-h-0 flex-wrap items-end gap-(--space-12) overflow-y-auto p-1">
        {/* O filtro novo entra primeiro, o mais perto da busca: é o recorte desta task. */}
        <Field className="w-full sm:w-[calc(190px*var(--text-scale))]">
          <FieldLabel htmlFor="atendimentos-canal">Canal</FieldLabel>
          <Select
            items={[
              { value: 'todos', label: 'Todos' },
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'telefone', label: 'Telefone' },
            ]}
            value={canal}
            onValueChange={(next) => next && onCanal(next as Canal | 'todos')}
          >
            <SelectTrigger id="atendimentos-canal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="telefone">Telefone</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field className="w-full sm:w-[calc(190px*var(--text-scale))]">
          <FieldLabel htmlFor="atendimentos-responsavel">Responsável</FieldLabel>
          <Select items={[{ value: 'todos', label: 'Todos os responsáveis' }]} value="todos">
            <SelectTrigger id="atendimentos-responsavel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field className="w-full sm:w-[calc(190px*var(--text-scale))]">
          <FieldLabel htmlFor="atendimentos-modulo">Módulo</FieldLabel>
          <Input id="atendimentos-modulo" placeholder="Parte do módulo" />
        </Field>
        <Field className="w-full sm:w-[calc(220px*var(--text-scale))]">
          <FieldLabel htmlFor="atendimentos-assunto">Assunto</FieldLabel>
          <Input id="atendimentos-assunto" placeholder="Parte do assunto" />
        </Field>
        {canal !== 'todos' && (
          <p className="caption w-full text-ink-faint">
            {contagem} {contagem === 1 ? 'chamado' : 'chamados'} no canal{' '}
            {canal === 'telefone' ? 'Telefone' : 'WhatsApp'}.
          </p>
        )}
      </div>
    </div>
  )
}

function Paginacao({ total }: { total: number }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line-soft px-[15px] py-2.5">
      <p className="caption text-ink-faint">
        {total} {total === 1 ? 'chamado' : 'chamados'}
      </p>
      <p className="caption text-ink-faint">Página 1 de 1</p>
    </div>
  )
}

function TelaLista({
  canal,
  onCanal,
}: {
  canal: Canal | 'todos'
  onCanal: (c: Canal | 'todos') => void
}) {
  const [query, setQuery] = useState('')
  const filtrados = useMemo(
    () =>
      registros.filter((registro) => {
        if (canal !== 'todos' && registro.channel !== canal) {
          return false
        }
        const termo = query.trim().toLowerCase()
        if (!termo) {
          return true
        }
        return [
          registro.protocol,
          registro.contact.name,
          formatPhone(registro.contact.phone),
          registro.organization,
        ]
          .join(' ')
          .toLowerCase()
          .includes(termo)
      }),
    [canal, query],
  )
  return (
    <>
      <div className="mx-auto flex min-h-0 w-full max-w-(--content-max) flex-1 flex-col gap-4 overflow-hidden px-4 py-4 md:px-[30px] md:py-[30px]">
        <Filters
          query={query}
          onQuery={setQuery}
          canal={canal}
          onCanal={onCanal}
          contagem={filtrados.length}
        />
        <Card className="min-h-0 flex-1 gap-0 py-0">
          {filtrados.length > 0 ? (
            <Table containerClassName="min-h-0 flex-1 overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 in-data-[contrast=high]:bg-background">
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Órgão</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Módulos</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((registro) => (
                  <TicketRow key={registro.id} registro={registro} />
                ))}
              </TableBody>
            </Table>
          ) : (
            <Empty>
              <EmptyMedia>
                <Inbox strokeWidth={1.7} aria-hidden />
              </EmptyMedia>
              <EmptyDescription>Nenhum chamado encontrado.</EmptyDescription>
            </Empty>
          )}
          <Paginacao total={filtrados.length} />
        </Card>
      </div>
    </>
  )
}

// A conversa não existe: no lugar dela, o aviso de que o atendimento foi por telefone.
function SemConversa() {
  return (
    <Card
      role="region"
      aria-label="Atendimento por telefone"
      className="flex min-h-0 flex-col overflow-clip"
    >
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
        <Empty>
          <EmptyMedia>
            <Phone strokeWidth={1.7} aria-hidden />
          </EmptyMedia>
          <EmptyDescription>
            <span className="body-strong block text-ink">
              Atendimento por telefone, sem conversa
            </span>
            Ligação das {timeFormat.format(new Date(registroTelefone.startedAt!))} às{' '}
            {timeFormat.format(new Date(registroTelefone.endedAt!))} ·{' '}
            {Math.round(
              (new Date(registroTelefone.endedAt!).getTime() -
                new Date(registroTelefone.startedAt!).getTime()) /
                60000,
            )}{' '}
            min. O registro fica nos Detalhes, ao lado.
          </EmptyDescription>
        </Empty>
      </div>
      <div className="border-t border-line-soft px-[15px] py-3">
        <p className="caption text-ink-faint">
          Registrado por {registroTelefone.assignee} em{' '}
          <span className="mono-num">{formatDateTime(registroTelefone.closedAt)}</span>.
        </p>
      </div>
    </Card>
  )
}

function DetalheLinha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label text-ink-soft">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function DetalhesTab() {
  const registro = registroTelefone
  return (
    <dl className="flex flex-col gap-3">
      <DetalheLinha label="Protocolo">
        <span className="mono-num">{registro.protocol}</span>
      </DetalheLinha>
      <DetalheLinha label="Situação">
        <Badge tone="neutral">Encerrado</Badge>
      </DetalheLinha>
      <DetalheLinha label="Canal">
        <MarcaTelefone />
      </DetalheLinha>
      <DetalheLinha label="Setor">Atendimento</DetalheLinha>
      <DetalheLinha label="Contato">
        {registro.contact.name}
        <span className="mono-num caption block text-ink-faint">
          {formatPhone(registro.contact.phone)}
        </span>
      </DetalheLinha>
      <DetalheLinha label="Órgão">
        {registro.organization} · {registro.municipality}
      </DetalheLinha>
      <DetalheLinha label="Responsável">{registro.assignee}</DetalheLinha>
      <DetalheLinha label="Registrado por">{registro.assignee}</DetalheLinha>
      <DetalheLinha label="Encerrado em">
        <span className="mono-num">{formatDateTime(registro.closedAt)}</span>
      </DetalheLinha>
      <DetalheLinha label="Assunto">{registro.subject}</DetalheLinha>
      <DetalheLinha label="Resolução">
        <span className="whitespace-pre-wrap break-words">
          Cliente ligou sobre o documento que não anexava. Orientado a limpar o cache do navegador;
          o envio funcionou durante a ligação.
        </span>
      </DetalheLinha>
      <DetalheLinha label="Módulos">
        <span className="flex flex-wrap gap-1">
          {registro.modules.map((module) => (
            <Badge key={module} variant="tag">
              {module}
            </Badge>
          ))}
        </span>
      </DetalheLinha>
      <DetalheLinha label="Início">
        <span className="mono-num">{formatDateTime(registro.startedAt!)}</span>
      </DetalheLinha>
      <DetalheLinha label="Fim">
        <span className="mono-num">{formatDateTime(registro.endedAt!)}</span>
      </DetalheLinha>
      <div>
        <Overline>Histórico de alterações</Overline>
        <p className="caption mt-1 text-ink-faint">Nenhuma correção.</p>
      </div>
    </dl>
  )
}

// Item do histórico do contato e do órgão, com a marca Telefone ao lado do protocolo.
function HistoryItem({ registro, este = false }: { registro: Registro; este?: boolean }) {
  return (
    <li className="flex flex-col gap-1 py-2.5">
      <div className="flex items-center gap-2">
        <span className="mono-num body-strong text-accent-strong underline-offset-2">
          {registro.protocol}
        </span>
        {este && <span className="caption text-ink-faint">Este chamado</span>}
        <Badge tone="neutral" className="ml-auto">
          Encerrado
        </Badge>
      </div>
      <p className="flex items-center gap-1.5 caption text-ink-faint">
        {registro.channel === 'telefone' && <MarcaTelefone />}
        <span className="truncate">
          Atendimento · {registro.organization} · {registro.municipality}
        </span>
      </p>
      <p className="caption text-ink-faint">
        <span className="mono-num">{formatDateTime(registro.closedAt)}</span> · {registro.assignee}
      </p>
    </li>
  )
}

function HistoricoTab() {
  const doContato = registros.filter(
    (registro) =>
      registro.contact.name === 'João da Silva' || registro.contact.name === 'Patrícia Gomes',
  )
  const doOrgao = registros.filter((registro) => registro.organization === 'Secretaria de Educação')
  return (
    <div className="flex flex-col gap-4">
      <section>
        <Overline>Do contato</Overline>
        <ul aria-label="Chamados do contato" className="flex flex-col divide-y divide-line-soft">
          {doContato.map((registro) => (
            <HistoryItem
              key={registro.id}
              registro={registro}
              este={registro.channel === 'telefone'}
            />
          ))}
        </ul>
      </section>
      <section>
        <Overline>Do órgão</Overline>
        <ul aria-label="Chamados do órgão" className="flex flex-col divide-y divide-line-soft">
          {doOrgao.map((registro) => (
            <HistoryItem key={registro.id} registro={registro} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function TelaDetalhe({ aba }: { aba: 'details' | 'history' }) {
  const registro = registroTelefone
  return (
    <div className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden px-4 py-4 md:px-[30px] md:py-[30px]">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Voltar aos Atendimentos">
          <ArrowLeft strokeWidth={1.7} aria-hidden />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="caption text-ink-faint">Atendimento · {registro.protocol}</p>
          <h1 className="title-page truncate">{registro.contact.name}</h1>
        </div>
        <Button>
          <PencilLine strokeWidth={1.7} aria-hidden />
          Corrigir
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)]">
        <SemConversa />
        <Card role="region" aria-labelledby="ticket-info-title" className="min-h-0">
          <CardHeader>
            <CardTitle id="ticket-info-title">Atendimento</CardTitle>
          </CardHeader>
          <Tabs value={aba} className="min-h-0 flex-1 px-5 pb-5">
            <TabsList>
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="min-h-0 overflow-y-auto">
              <DetalhesTab />
            </TabsContent>
            <TabsContent value="history" className="min-h-0 overflow-y-auto">
              <HistoricoTab />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

const params = new URLSearchParams(window.location.search)
const telaParam = (params.get('tela') ?? 'lista') as Tela
const canalParam = (params.get('canal') ?? 'todos') as Canal | 'todos'
const temaParam = (params.get('tema') ?? 'claro') as Tema
const captura = params.get('captura') === '1'

export default function Prototype320() {
  const [tela, setTela] = useState<Tela>(telaParam)
  const [canal, setCanal] = useState<Canal | 'todos'>(canalParam)
  const [tema, setTema] = useState<Tema>(temaParam)

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = tema === 'contraste' ? 'high' : 'normal'
  }, [tema])

  // O filtro guardado no endereço, como os outros da tela (regra 11 de queue.md).
  useEffect(() => {
    const next = new URLSearchParams()
    next.set('prototype', '320')
    if (tela !== 'lista') {
      next.set('tela', tela)
    }
    if (canal !== 'todos') {
      next.set('canal', canal)
    }
    window.history.replaceState({}, '', `${window.location.pathname}?${next.toString()}`)
  }, [tela, canal])

  const titulo =
    tela === 'lista'
      ? 'Atendimentos'
      : tela === 'detalhe'
        ? registroTelefone.contact.name
        : registroTelefone.contact.name

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
        <div className="flex items-center gap-2">
          <Badge variant="tag" className="hidden sm:inline-flex">
            Supervisão
          </Badge>
          <Button variant="outline" size="icon" aria-label="Notificações">
            <Bell strokeWidth={1.7} aria-hidden />
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-(--sidebar-width) shrink-0 flex-col gap-1 border-r border-line bg-card px-3 py-4 text-sm">
          <p className="overline px-2 pb-1 text-ink-faint">Helpdesk</p>
          <p className="px-2 py-2">Chamados</p>
          <p
            className={
              tela === 'lista'
                ? 'rounded-(--radius-7) bg-accent-soft px-2 py-2 font-medium text-accent-strong'
                : 'px-2 py-2'
            }
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
          {tela === 'lista' ? (
            <>
              <header className="shrink-0 border-b border-line-soft bg-background">
                <div className="mx-auto flex max-w-(--content-max) flex-wrap items-center gap-3 px-4 py-3 md:px-[30px]">
                  <div className="min-w-0 flex-1">
                    <p className="caption text-ink-faint">Atendimento</p>
                    <h1 className="title-page truncate">{titulo}</h1>
                  </div>
                </div>
              </header>
              <TelaLista canal={canal} onCanal={setCanal} />
            </>
          ) : (
            <TelaDetalhe aba={tela === 'historico' ? 'history' : 'details'} />
          )}
        </main>
      </div>
      {!captura && (
        <div className="fixed bottom-3 left-1/2 z-40 flex max-w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <strong>Protótipo #320</strong>
          <span className="text-ink-soft">proposta (A)</span>
          <Button
            variant={tela === 'lista' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTela('lista')}
          >
            Lista
          </Button>
          <Button
            variant={tela === 'detalhe' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTela('detalhe')}
          >
            Detalhe
          </Button>
          <Button
            variant={tela === 'historico' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTela('historico')}
          >
            Histórico
          </Button>
          <label className="flex items-center gap-1">
            Tema
            <select
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={tema}
              onChange={(event) => setTema(event.target.value as Tema)}
            >
              <option value="claro">Claro</option>
              <option value="escuro">Escuro</option>
              <option value="contraste">Alto contraste</option>
            </select>
          </label>
          <span className="w-full text-ink-soft">
            Filtro Canal em{' '}
            <span className="mono-num">
              /atendimentos?{canal === 'todos' ? '' : `canal=${canal}`}
            </span>
            {canal === 'todos' ? ' (sem parâmetro: Todos)' : ' (sobrevive a recarregar)'}. A marca
            Telefone aparece na Situação; os de WhatsApp não ganham marca.
          </span>
        </div>
      )}
    </div>
  )
}
