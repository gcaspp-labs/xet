import { BarChart3, ChevronDown, ChevronUp, CircleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { OrganizationPicker } from '@/components/ContactSheet'
import { KpiCard } from '@/components/KpiCard'
import { PageContent, Topbar } from '@/components/Topbar'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useModules, useSectors } from '@/lib/admin'
import {
  type Dashboard,
  type DashboardAssignee,
  type DashboardNumber,
  type DashboardSection,
  type PeriodChoice,
  useDashboard,
  useDashboardAssignees,
  useDashboardFilter,
  useSectionCollapsed,
} from '@/lib/dashboard'
import { formatDay, formatAverageTime, organizationLabel } from '@/lib/format'
// PROTÓTIPO #160: versão aprovada (C) da fila e dos em atendimento.
import { useLiveLists, VariantC } from '@/prototype/DashboardLists'

const notApplicable = 'Não se aplica ao filtro'
const noDataMark = '—'
const all = 'all'

const periodChoices: { value: PeriodChoice; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Datas' },
]

type Format = (value: number) => string
const asCount: Format = String

function display(number: DashboardNumber, format: Format) {
  return number.applicable && number.value !== null ? format(number.value) : noDataMark
}

function Kpi({
  label,
  number,
  format = asCount,
}: {
  label: string
  number: DashboardNumber | undefined
  format?: Format
}) {
  return (
    <KpiCard
      label={label}
      value={number ? display(number, format) : <Skeleton className="my-2 h-6 w-16" />}
      hint={number && !number.applicable ? notApplicable : undefined}
    />
  )
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
    <Field className="w-full sm:w-[calc(200px*var(--text-scale))]">
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

function withStatus(option: { name: string; active: boolean }) {
  return option.active ? option.name : `${option.name} (inativo)`
}

function Filters({
  filter,
  shownPeriod,
}: {
  filter: ReturnType<typeof useDashboardFilter>
  shownPeriod: Dashboard['period'] | undefined
}) {
  const { data: sectors = [] } = useSectors()
  const { data: assignees = [] } = useDashboardAssignees(filter.sectorId)
  const { data: modules = [] } = useModules(filter.sectorId)
  const noSector = filter.sectorId === undefined

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        aria-label="Período"
        value={[filter.period]}
        onValueChange={(values: string[]) => {
          // Seleção única: clicar no chip ativo não o desliga.
          const [value] = values
          if (value) {
            filter.setPeriod(value as PeriodChoice, shownPeriod)
          }
        }}
      >
        {periodChoices.map((choice) => (
          <ToggleGroupItem key={choice.value} value={choice.value}>
            {choice.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-wrap items-start gap-3">
        {filter.period === 'custom' && (
          <>
            <Field className="w-full sm:w-[calc(170px*var(--text-scale))]">
              <FieldLabel htmlFor="dashboard-from">Início</FieldLabel>
              <Input
                id="dashboard-from"
                type="date"
                value={filter.from}
                onChange={(event) => filter.setDate('from', event.target.value)}
              />
            </Field>
            <Field className="w-full sm:w-[calc(170px*var(--text-scale))]">
              <FieldLabel htmlFor="dashboard-to">Fim</FieldLabel>
              <Input
                id="dashboard-to"
                type="date"
                value={filter.to}
                onChange={(event) => filter.setDate('to', event.target.value)}
              />
            </Field>
          </>
        )}
        {filter.isAdmin && (
          <FilterSelect
            id="dashboard-sector"
            label="Setor"
            allLabel="Todos os setores"
            options={sectors.map((sector) => ({ value: String(sector.id), label: sector.name }))}
            value={filter.sectorId}
            onChange={filter.setSector}
          />
        )}
        <FilterSelect
          id="dashboard-assignee"
          label="Atendente"
          allLabel="Todos os atendentes"
          options={assignees.map((person) => ({
            value: String(person.id),
            label: withStatus(person),
          }))}
          value={filter.assigneeId}
          disabled={noSector}
          onChange={filter.setAssignee}
        />
        <FilterSelect
          id="dashboard-module"
          label="Módulo"
          allLabel="Todos os módulos"
          options={modules.map((module) => ({
            value: String(module.id),
            label: withStatus(module),
          }))}
          value={filter.moduleId}
          disabled={noSector}
          onChange={filter.setModule}
        />
        <Field className="w-full sm:w-[calc(260px*var(--text-scale))]">
          <FieldLabel htmlFor="dashboard-organization">Órgão</FieldLabel>
          <OrganizationPicker
            id="dashboard-organization"
            placeholder="Todos os órgãos"
            clearLabel="Limpar órgão"
            value={filter.organization}
            onChange={(value) =>
              filter.setOrganization(
                value,
                value ? organizationLabel(value.name, value.municipality.name) : '',
              )
            }
          />
        </Field>
      </div>
    </div>
  )
}

function KpiSection({
  section,
  title,
  detail,
  children,
}: {
  section: DashboardSection
  title: string
  detail?: string
  children: ReactNode
}) {
  const id = useId()
  const [collapsed, toggle] = useSectionCollapsed(section)
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
          onClick={toggle}
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

function periodDetail(period: Dashboard['period'] | undefined) {
  if (!period) {
    return undefined
  }
  return period.from === period.to
    ? formatDay(period.from)
    : `${formatDay(period.from)} a ${formatDay(period.to)}`
}

const assigneeColumns: {
  key: keyof Omit<DashboardAssignee, 'user' | 'sector'>
  label: string
  format: Format
}[] = [
  { key: 'inProgress', label: 'Em atendimento', format: asCount },
  { key: 'started', label: 'Iniciados', format: asCount },
  { key: 'resolved', label: 'Encerrados', format: asCount },
  { key: 'transferred', label: 'Transferidos', format: asCount },
  { key: 'cancelled', label: 'Cancelados', format: asCount },
  { key: 'averageHandlingSeconds', label: 'Tempo médio de atendimento', format: formatAverageTime },
]

const listFormat = new Intl.ListFormat('pt-BR')

function AssigneesCard({
  assignees,
  allSectors,
}: {
  assignees: DashboardAssignee[]
  allSectors: boolean
}) {
  // Com "—" na célula, a nota diz quais colunas o filtro deixou de fora.
  const excluded = assigneeColumns.filter((column) =>
    assignees.some((row) => !row[column.key].applicable),
  )
  return (
    <Card role="region" aria-labelledby="dashboard-assignees-title">
      <CardHeader>
        <CardTitle id="dashboard-assignees-title">Por atendente</CardTitle>
      </CardHeader>
      {assignees.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atendente</TableHead>
                {allSectors && <TableHead>Setor</TableHead>}
                {assigneeColumns.map((column) => (
                  <TableHead key={column.key} className="text-right">
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignees.map((row) => (
                <TableRow key={`${row.sector.id}-${row.user.id}`}>
                  <TableCell className="body-strong">{row.user.name}</TableCell>
                  {allSectors && <TableCell>{row.sector.name}</TableCell>}
                  {assigneeColumns.map((column) => (
                    <TableCell key={column.key} className="mono-num text-right">
                      {display(row[column.key], column.format)}
                      {!row[column.key].applicable && (
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
              {notApplicable}: {listFormat.format(excluded.map((column) => column.label))}.
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

export default function DashboardPage() {
  const filter = useDashboardFilter()
  const { data, error } = useDashboard(filter.search, filter.datesValid)
  const { data: sectors = [] } = useSectors()
  const sector = sectors.find((item) => item.id === filter.sectorId)
  const numbers = data?.numbers
  const { data: lists } = useLiveLists(filter.search)
  const showSector = filter.isAdmin && filter.sectorId === undefined
  const moduleOn = filter.moduleId !== undefined

  return (
    <>
      <Topbar breadcrumb={sector ? `Helpdesk · ${sector.name}` : 'Helpdesk'} title="Dashboard" />
      <PageContent>
        <Filters filter={filter} shownPeriod={data?.period} />
        {!filter.datesValid && (
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>
              Período incompleto ou invertido. Informe o início e o fim, com o início antes do fim.
            </AlertDescription>
          </Alert>
        )}
        {filter.datesValid && error && (
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        <KpiSection section="now" title="Agora">
          <Kpi label="Na fila" number={numbers?.queued} />
          <Kpi label="Em atendimento" number={numbers?.inProgress} />
        </KpiSection>
        {lists && <VariantC lists={lists} showSector={showSector} moduleOn={moduleOn} />}
        <KpiSection section="period" title="No período" detail={periodDetail(data?.period)}>
          <Kpi label="Recebidos" number={numbers?.received} />
          <Kpi label="Iniciados" number={numbers?.started} />
          <Kpi label="Encerrados" number={numbers?.resolved} />
          <Kpi label="Transferidos" number={numbers?.transferred} />
          <Kpi label="Cancelados" number={numbers?.cancelled} />
          <Kpi
            label="Tempo médio de espera"
            number={numbers?.averageWaitSeconds}
            format={formatAverageTime}
          />
          <Kpi
            label="Tempo médio de atendimento"
            number={numbers?.averageHandlingSeconds}
            format={formatAverageTime}
          />
        </KpiSection>
        {data && <AssigneesCard assignees={data.assignees} allSectors={data.sectorId === null} />}
      </PageContent>
    </>
  )
}
