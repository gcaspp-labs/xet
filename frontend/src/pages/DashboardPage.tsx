import { ChevronDown, ChevronUp, CircleAlert } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { DashboardLists } from '@/components/DashboardLists'
import { OrganizationPicker } from '@/components/ContactSheet'
import { PageContent, Topbar } from '@/components/Topbar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useModules, useSectors } from '@/lib/admin'
import {
  type Dashboard,
  type DashboardAssignee,
  type DashboardChannel,
  type DashboardNumber,
  type DashboardSection,
  type PeriodChoice,
  useDashboard,
  useDashboardAssignees,
  useDashboardFilter,
  useSectionCollapsed,
} from '@/lib/dashboard'
import { formatDay, formatAverageTime, organizationLabel } from '@/lib/format'

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

const channelChoices: { value: DashboardChannel; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Telefone' },
]

// O canal vale para os encerramentos e a tabela por atendente; nos demais
// números, a API diz que ele não se aplica (regra 13 de dashboard.md).
function ChannelFilter({
  value,
  onChange,
}: {
  value: DashboardChannel | undefined
  onChange: (value: DashboardChannel | undefined) => void
}) {
  const items = [{ value: all, label: 'Todos os canais' }, ...channelChoices]
  return (
    <Field className="w-full sm:w-[calc(190px*var(--text-scale))]">
      <FieldLabel htmlFor="dashboard-channel">Canal</FieldLabel>
      <Select
        items={items}
        value={value ?? all}
        onValueChange={(next) =>
          next && onChange(next === all ? undefined : (next as DashboardChannel))
        }
      >
        <SelectTrigger id="dashboard-channel">
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
        <ChannelFilter value={filter.channel} onChange={filter.setChannel} />
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

// A seção recolhe o que estiver dentro dela (as listas, em "Agora", e a tabela, em
// "No período"), com a escolha guardada no navegador (regra 6 de dashboard.md).
function Section({
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
      {!collapsed && children}
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

const listFormat = new Intl.ListFormat('pt-BR')

type Numbers = Dashboard['numbers']
type AssigneeNumberKey = keyof Omit<DashboardAssignee, 'user' | 'sector'>

// Colunas por atendente. O "Em atendimento" é a carga atual da pessoa.
const assigneeColumns: { key: AssigneeNumberKey; label: string; format: Format }[] = [
  { key: 'inProgress', label: 'Em atendimento', format: asCount },
  { key: 'started', label: 'Iniciados', format: asCount },
  { key: 'resolved', label: 'Encerrados', format: asCount },
  { key: 'transferred', label: 'Transferidos', format: asCount },
  { key: 'cancelled', label: 'Cancelados', format: asCount },
  { key: 'averageHandlingSeconds', label: 'Tempo médio de atendimento', format: formatAverageTime },
]

// Os números do setor que não pertencem a uma pessoa (linha "Do setor").
const sectorNumbers: { key: keyof Numbers; label: string; format: Format }[] = [
  { key: 'received', label: 'Recebidos', format: asCount },
  { key: 'averageWaitSeconds', label: 'Tempo médio de espera', format: formatAverageTime },
]

function NumberCell({
  number,
  format,
  className,
}: {
  number: DashboardNumber
  format: Format
  className?: string
}) {
  return (
    <TableCell className={`mono-num text-right ${className ?? ''}`}>
      {display(number, format)}
      {!number.applicable && <span className="sr-only"> {notApplicable}</span>}
    </TableCell>
  )
}

// A tabela por atendente com a linha TOTAL (a média de atendimento é a média geral, não
// a soma das médias) e a linha "Do setor", ambas seguindo os filtros (regra 13).
function PeriodTable({
  assignees,
  numbers,
  allSectors,
}: {
  assignees: DashboardAssignee[]
  numbers: Numbers
  allSectors: boolean
}) {
  // Com "—" na célula, a nota diz quais números o filtro deixou de fora.
  const excluded = [...assigneeColumns, ...sectorNumbers].filter(
    (column) => !numbers[column.key].applicable,
  )
  const lead = allSectors ? 2 : 1
  return (
    <Card role="region" aria-labelledby="dashboard-assignees-title">
      <Table>
        <caption id="dashboard-assignees-title" className="sr-only">
          Por atendente
        </caption>
        <TableHeader>
          <TableRow>
            <TableHead className="text-ink">Atendente</TableHead>
            {allSectors && <TableHead className="text-ink">Setor</TableHead>}
            {assigneeColumns.map((column) => (
              <TableHead key={column.key} className="text-right text-ink">
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
                <NumberCell key={column.key} number={row[column.key]} format={column.format} />
              ))}
            </TableRow>
          ))}
          {assignees.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={lead + assigneeColumns.length}
                className="py-6 text-center text-ink-faint"
              >
                Nenhum atendente com números nestes filtros.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter className="border-t-2 border-line bg-muted font-normal">
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={lead} className="body-strong uppercase tracking-wide">
              Total
            </TableCell>
            {assigneeColumns.map((column) => (
              <NumberCell
                key={column.key}
                number={numbers[column.key]}
                format={column.format}
                className="body-strong"
              />
            ))}
          </TableRow>
          <TableRow className="border-t border-line-soft hover:bg-transparent">
            <TableCell colSpan={lead} className="body-strong">
              Do setor
            </TableCell>
            <TableCell colSpan={assigneeColumns.length}>
              <span className="flex flex-wrap gap-x-6">
                {sectorNumbers.map((item) => (
                  <span key={item.key}>
                    {item.label}{' '}
                    <span className="mono-num body-strong">
                      {display(numbers[item.key], item.format)}
                    </span>
                    {!numbers[item.key].applicable && (
                      <span className="sr-only"> {notApplicable}</span>
                    )}
                  </span>
                ))}
              </span>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
      {excluded.length > 0 && (
        <p className="caption border-t border-line-soft px-5 py-3 text-ink-faint">
          {notApplicable}: {listFormat.format(excluded.map((column) => column.label))}.
        </p>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const filter = useDashboardFilter()
  const { data, error } = useDashboard(filter.search, filter.datesValid)
  const { data: sectors = [] } = useSectors()
  const sector = sectors.find((item) => item.id === filter.sectorId)

  return (
    <>
      <Topbar breadcrumb={sector?.name} title="Dashboard" />
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
        <Section section="now" title="Agora">
          <DashboardLists
            sectorId={filter.sectorId}
            assigneeId={filter.assigneeId}
            organizationId={filter.organization?.id}
            showSector={filter.isAdmin && filter.sectorId === undefined}
          />
        </Section>
        <Section section="period" title="No período" detail={periodDetail(data?.period)}>
          {data ? (
            <PeriodTable
              assignees={data.assignees}
              numbers={data.numbers}
              allSectors={data.sectorId === null}
            />
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </Section>
      </PageContent>
    </>
  )
}
