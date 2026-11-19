import { CircleAlert, Inbox } from 'lucide-react'
import { type ReactNode, useDeferredValue, useEffect } from 'react'
import { Link } from 'react-router'
import { Pagination } from '@/components/Pagination'
import { SearchBox } from '@/components/SearchBox'
import { SortableTableHead } from '@/components/SortableTableHead'
import { Topbar } from '@/components/Topbar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from '@/components/ui/autocomplete'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useSectors } from '@/lib/admin'
import { useCurrentUser } from '@/lib/auth'
import {
  type ClosedTicket,
  type ClosedTicketsFilter,
  closedTicketColumns,
  defaultClosedTicketColumn,
  type PeriodChoice,
  useClosedTicketFilterOptions,
  useClosedTicketSubjects,
  useClosedTickets,
  useClosedTicketsFilter,
} from '@/lib/closed-tickets'
import { closureTypeLabels, formatPhone, organizationLabel } from '@/lib/format'
import { usePagedList } from '@/lib/paging'

const periodChoices: { value: PeriodChoice; label: string }[] = [
  { value: 'all', label: 'Todo o período' },
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Datas' },
]

const all = 'all'
const lockedHint = 'Escolha um setor'

// A data e a hora do encerramento no horário de Brasília, o mesmo dos períodos do filtro.
const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' })
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

function formatClosedAt(value: string) {
  const moment = new Date(value)
  const day =
    dayFormat.format(moment) === dayFormat.format(new Date()) ? 'Hoje' : dateFormat.format(moment)
  return `${day} ${timeFormat.format(moment)}`
}

function FilterSelect({
  id,
  label,
  allLabel,
  options,
  value,
  disabled,
  onChange,
}: {
  id: string
  label: string
  allLabel: string
  options: { value: string; label: string }[]
  value: number | undefined
  disabled?: boolean
  onChange: (value: number | undefined) => void
}) {
  const items = [{ value: all, label: allLabel }, ...options]
  // Enquanto a lista carrega, o valor ainda não tem nome para mostrar.
  const selected = items.some((item) => item.value === value?.toString()) ? value!.toString() : all
  return (
    <Field className="w-full sm:w-[calc(190px*var(--text-scale))]">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={items}
        value={selected}
        disabled={disabled}
        onValueChange={(next) => next && onChange(next === all ? undefined : Number(next))}
      >
        <SelectTrigger id={id}>
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

// Os módulos do setor são poucos e já vêm com os filtros: as sugestões saem dessa lista,
// pelo texto contido, sem diferenciar acentos nem maiúsculas.
function ModuleField({
  filter,
  modules,
  disabled,
}: {
  filter: ClosedTicketsFilter
  modules: { name: string }[]
  disabled: boolean
}) {
  const names = [...new Set(modules.map((module) => module.name))]
  return (
    <Field className="w-full sm:w-[calc(190px*var(--text-scale))]">
      <FieldLabel htmlFor="atendimentos-modulo">Módulo</FieldLabel>
      <Autocomplete
        items={names}
        value={filter.module}
        disabled={disabled}
        onValueChange={(next) => filter.setModule(next)}
      >
        <AutocompleteInput
          id="atendimentos-modulo"
          placeholder={disabled ? lockedHint : 'Parte do módulo'}
        />
        <AutocompleteContent>
          <AutocompleteList>
            {(name: string) => (
              <AutocompleteItem key={name} value={name}>
                {name}
              </AutocompleteItem>
            )}
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>
    </Field>
  )
}

function withStatus(option: { name: string; active: boolean }) {
  return option.active ? option.name : `${option.name} (inativo)`
}

function SubjectField({ filter }: { filter: ClosedTicketsFilter }) {
  const typed = useDeferredValue(filter.subject)
  const { data: suggestions = [] } = useClosedTicketSubjects(filter, typed)
  return (
    <Field className="w-full sm:w-[calc(220px*var(--text-scale))]">
      <FieldLabel htmlFor="atendimentos-assunto">Assunto</FieldLabel>
      <Autocomplete
        items={suggestions}
        filteredItems={suggestions}
        value={filter.subject}
        onValueChange={(next) => filter.setSubject(next)}
      >
        <AutocompleteInput id="atendimentos-assunto" placeholder="Parte do assunto" />
        <AutocompleteContent>
          <AutocompleteList>
            {(name: string) => (
              <AutocompleteItem key={name} value={name}>
                {name}
              </AutocompleteItem>
            )}
          </AutocompleteList>
        </AutocompleteContent>
      </Autocomplete>
    </Field>
  )
}

function Filters({ filter }: { filter: ClosedTicketsFilter }) {
  const { data: sectors = [] } = useSectors()
  const { data: options } = useClosedTicketFilterOptions(filter)
  const locked = !filter.hasSector

  return (
    <div className="flex shrink-0 flex-col gap-(--space-12)">
      <div className="flex flex-wrap items-center justify-between gap-(--space-12)">
        <SearchBox
          value={filter.query}
          onChange={filter.setQuery}
          label="Buscar chamados"
          placeholder="Protocolo, contato, telefone ou órgão"
        />
        <ToggleGroup
          aria-label="Período"
          value={[filter.period]}
          onValueChange={(values: string[]) => {
            // Seleção única: clicar no chip ativo não o desliga.
            const [value] = values
            if (value) {
              filter.setPeriod(value as PeriodChoice)
            }
          }}
        >
          {periodChoices.map((choice) => (
            <ToggleGroupItem key={choice.value} value={choice.value}>
              {choice.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-end gap-(--space-12)">
        {filter.period === 'custom' && (
          <>
            <Field className="w-full sm:w-[calc(160px*var(--text-scale))]">
              <FieldLabel htmlFor="atendimentos-de">Início</FieldLabel>
              <Input
                id="atendimentos-de"
                type="date"
                value={filter.from}
                onChange={(event) => filter.setDate('de', event.target.value)}
              />
            </Field>
            <Field className="w-full sm:w-[calc(160px*var(--text-scale))]">
              <FieldLabel htmlFor="atendimentos-ate">Fim</FieldLabel>
              <Input
                id="atendimentos-ate"
                type="date"
                value={filter.to}
                onChange={(event) => filter.setDate('ate', event.target.value)}
              />
            </Field>
          </>
        )}
        {filter.isAdmin && (
          <FilterSelect
            id="atendimentos-setor"
            label="Setor"
            allLabel="Todos os setores"
            options={sectors.map((sector) => ({ value: String(sector.id), label: sector.name }))}
            value={filter.sectorId}
            onChange={filter.setSector}
          />
        )}
        <FilterSelect
          id="atendimentos-responsavel"
          label="Responsável"
          allLabel={locked ? lockedHint : 'Todos os responsáveis'}
          options={(options?.assignees ?? []).map((person) => ({
            value: String(person.id),
            label: withStatus(person),
          }))}
          value={filter.assigneeId}
          disabled={locked}
          onChange={filter.setAssignee}
        />
        <ModuleField filter={filter} modules={options?.modules ?? []} disabled={locked} />
        <SubjectField filter={filter} />
      </div>
    </div>
  )
}

function Faint({ children }: { children: ReactNode }) {
  return <span className="text-ink-faint">{children}</span>
}

function SituationCell({ ticket }: { ticket: ClosedTicket }) {
  const type = ticket.closureType ?? 'resolved'
  return (
    <span className="flex flex-col gap-(--space-4)">
      <Badge tone={type === 'cancelled' ? 'danger' : 'neutral'}>{closureTypeLabels[type]}</Badge>
      {ticket.transferredTo && (
        <span className="caption text-ink-faint">para {ticket.transferredTo.name}</span>
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
    <Faint>—</Faint>
  )
}

// O link se estica sobre a linha, que precisa ser `relative`: a linha inteira abre a
// ficha, e o teclado e o leitor de tela continuam num link de verdade.
function TicketRow({ ticket, isAdmin }: { ticket: ClosedTicket; isAdmin: boolean }) {
  const organization = ticket.organizationName
    ? organizationLabel(ticket.organizationName, ticket.municipalityName)
    : undefined
  return (
    <TableRow className="relative">
      <TableCell className="mono-num caption whitespace-nowrap">
        <Link
          to={`/atendimentos/${ticket.id}`}
          className="body-strong underline-offset-2 after:absolute after:inset-0 hover:text-accent-strong hover:underline"
        >
          {ticket.protocol}
        </Link>
      </TableCell>
      <TableCell className="mono-num caption whitespace-nowrap">
        {ticket.closedAt ? formatClosedAt(ticket.closedAt) : <Faint>—</Faint>}
      </TableCell>
      <TableCell className="max-w-[120px]">
        <p className="truncate" title={ticket.contact.name}>
          {ticket.contact.name}
        </p>
        <p className="mono-num caption text-ink-faint">
          {ticket.contact.phone ? formatPhone(ticket.contact.phone) : 'Sem telefone'}
        </p>
      </TableCell>
      <TableCell className="max-w-[110px] truncate" title={organization}>
        {ticket.organizationName ?? <Faint>Não cadastrado</Faint>}
      </TableCell>
      {isAdmin && (
        <TableCell className="max-w-[110px] truncate" title={ticket.sector.name}>
          {ticket.sector.name}
        </TableCell>
      )}
      <TableCell className="max-w-[100px] truncate" title={ticket.assignee?.name}>
        {ticket.assignee?.name ?? <Faint>—</Faint>}
      </TableCell>
      <TableCell className="max-w-[110px] truncate" title={ticket.subject ?? undefined}>
        {ticket.subject ?? <Faint>—</Faint>}
      </TableCell>
      <TableCell>
        <ModulesCell modules={ticket.modules} />
      </TableCell>
      <TableCell>
        <SituationCell ticket={ticket} />
      </TableCell>
    </TableRow>
  )
}

export default function AtendimentosPage() {
  // Busca, filtros, página e ordem ficam no endereço: voltar da ficha ou reabrir o link
  // devolve a mesma lista.
  const filter = useClosedTicketsFilter()
  const list = usePagedList(closedTicketColumns, defaultClosedTicketColumn, 'desc')
  const { data: sectors = [] } = useSectors()
  const { data, error, isPlaceholderData } = useClosedTickets(filter, list.request)
  const tickets = data?.items
  const served = data && !isPlaceholderData ? data.page : undefined
  const { correctPage } = list
  // Página além da última: o servidor devolve a última, e o endereço acompanha.
  useEffect(() => {
    if (served !== undefined) {
      correctPage(served)
    }
  }, [served, correctPage])
  const { data: user } = useCurrentUser()
  // O breadcrumb diz o setor: o da pessoa ou, para o administrador, o escolhido.
  const sector = sectors.find(
    (item) => item.id === (filter.isAdmin ? filter.sectorId : user?.sectorId),
  )

  return (
    // A página tem a altura da janela e não rola: só a lista rola, dentro do painel (regra 33).
    <div className="flex h-[calc(100dvh-var(--header-height)-var(--realtime-note-height,0px))] flex-col overflow-clip [&>header]:shrink-0">
      <Topbar
        breadcrumb={sector?.name ?? (filter.isAdmin ? 'Todos os setores' : undefined)}
        title="Atendimentos"
      />
      {/* Se os filtros ocuparem quase toda a janela (celular, texto Maior), o painel mantém uma
          altura mínima e a área abaixo do cabeçalho rola, nunca a página. */}
      <div className="mx-auto flex min-h-0 w-full max-w-(--content-max) flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 md:px-[30px] md:py-[30px]">
        <Filters filter={filter} />
        {!filter.datesValid && (
          <Alert variant="warning" className="shrink-0">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>
              Período invertido. O início precisa ser antes do fim.
            </AlertDescription>
          </Alert>
        )}
        {filter.datesValid && error && (
          <Alert variant="warning" className="shrink-0">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        <Card className="min-h-64 flex-1 gap-0 py-0">
          {tickets && tickets.length > 0 ? (
            <Table containerClassName="min-h-0 flex-1 overflow-y-auto">
              <TableHeader className="sticky top-0 z-10 in-data-[contrast=high]:bg-background">
                <TableRow>
                  <SortableTableHead label="Protocolo" column="protocolo" list={list} />
                  <SortableTableHead label="Data" column="data" list={list} />
                  <SortableTableHead label="Contato" column="contato" list={list} />
                  <SortableTableHead label="Órgão" column="orgao" list={list} />
                  {filter.isAdmin && <SortableTableHead label="Setor" column="setor" list={list} />}
                  <SortableTableHead label="Responsável" column="responsavel" list={list} />
                  <SortableTableHead label="Assunto" column="assunto" list={list} />
                  <TableHead>Módulos</TableHead>
                  <SortableTableHead label="Situação" column="situacao" list={list} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TicketRow key={ticket.id} ticket={ticket} isAdmin={filter.isAdmin} />
                ))}
              </TableBody>
            </Table>
          ) : (
            tickets && (
              <Empty>
                <EmptyMedia>
                  <Inbox strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>Nenhum chamado encontrado.</EmptyDescription>
              </Empty>
            )
          )}
          {data && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              noun={['chamado', 'chamados']}
              onPage={list.setPage}
            />
          )}
        </Card>
      </div>
    </div>
  )
}
