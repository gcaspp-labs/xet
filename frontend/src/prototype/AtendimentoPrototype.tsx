// PROTÓTIPO #164 — descartável, não vai para a main.
// Plano: três versões da lista Atendimento, trocadas por `?variant=A|B|C`, na rota `/`
// (no lugar do painel). `?perfil=admin` mostra o administrador (coluna e filtro de setor;
// responsável e módulo travados até escolher um setor). Dados fictícios, tudo em memória.
//   A (barra de filtros): busca e filtros com rótulo numa faixa acima da tabela.
//   B (filtros na lateral): coluna de filtros fixa à esquerda, situação em caixas com contagem.
//   C (abas de situação): abas por situação com contagem, filtros sob o botão "Filtros",
//     filtros ativos em etiquetas removíveis.

import { Inbox, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Pagination } from '@/components/Pagination'
import { SearchBox } from '@/components/SearchBox'
import { SortableTableHead } from '@/components/SortableTableHead'
import { PageContent, Topbar } from '@/components/Topbar'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from '@/components/ui/autocomplete'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCurrentUser } from '@/lib/auth'
import { normalizeSearch } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  allSubjects,
  modules,
  people,
  type ProtoTicket,
  type Situation,
  sectors,
  situationLabels,
  tickets,
  today,
} from './atendimentoData'

const pageSize = 20
const all = 'all'
const situations = Object.keys(situationLabels) as Situation[]

// ---------- estado no endereço ----------

type Period = 'all' | 'today' | '7d' | '30d' | 'custom'
const periodChoices: { value: Period; label: string }[] = [
  { value: 'all', label: 'Todo o período' },
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'custom', label: 'Datas' },
]

function useListState(isAdmin: boolean) {
  const [params, setParams] = useSearchParams()
  const update = (next: Record<string, string | null>) =>
    setParams((current) => {
      const copy = new URLSearchParams(current)
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === '') copy.delete(k)
        else copy.set(k, v)
      }
      // Qualquer mudança de filtro volta à página 1.
      if (!('pagina' in next)) copy.delete('pagina')
      return copy
    })
  const sector = isAdmin ? params.get('setor') : '1'
  const state = {
    q: params.get('q') ?? '',
    situations: (params.get('situacao')?.split(',').filter(Boolean) ?? []) as Situation[],
    period: (params.get('periodo') as Period) ?? 'all',
    from: params.get('de') ?? '',
    to: params.get('ate') ?? '',
    sector,
    assignee: sector ? params.get('responsavel') : null,
    module: sector ? params.get('modulo') : null,
    subject: params.get('assunto') ?? '',
    page: Math.max(1, Number(params.get('pagina')) || 1),
    column: params.get('ordem') ?? 'data',
    direction: (params.get('direcao') ?? (params.get('ordem') ? 'asc' : 'desc')) as
      | 'asc'
      | 'desc',
  }
  return {
    ...state,
    isAdmin,
    setQ: (v: string) => update({ q: v }),
    setSituations: (v: Situation[]) => update({ situacao: v.join(',') }),
    setPeriod: (v: Period) => update({ periodo: v === 'all' ? null : v }),
    setDate: (k: 'de' | 'ate', v: string) => update({ [k]: v }),
    // Trocar o setor limpa responsável e módulo.
    setSector: (v: string | null) => update({ setor: v, responsavel: null, modulo: null }),
    setAssignee: (v: string | null) => update({ responsavel: v }),
    setModule: (v: string | null) => update({ modulo: v }),
    setSubject: (v: string) => update({ assunto: v }),
    setPage: (p: number) => update({ pagina: p === 1 ? null : String(p) }),
    toggleSort: (c: string) => {
      const dir =
        state.column === c ? (state.direction === 'asc' ? 'desc' : 'asc') : c === 'data' ? 'desc' : 'asc'
      update({ ordem: c, direcao: dir })
    },
    clearAll: () =>
      setParams((current) => {
        const copy = new URLSearchParams()
        for (const k of ['variant', 'perfil']) {
          const v = current.get(k)
          if (v) copy.set(k, v)
        }
        return copy
      }),
  }
}
type ListState = ReturnType<typeof useListState>

const brDay = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

function applyFilters(s: ListState, ignoreSituation = false) {
  const q = normalizeSearch(s.q.trim())
  const subj = normalizeSearch(s.subject.trim())
  const todayKey = brDay(today)
  const daysAgo = (n: number) => brDay(new Date(today.getTime() - n * 86_400_000))
  return tickets.filter((t) => {
    if (s.sector && t.sectorId !== Number(s.sector)) return false
    if (!ignoreSituation && s.situations.length && !s.situations.includes(t.situation)) return false
    const day = brDay(t.date)
    if (s.period === 'today' && day !== todayKey) return false
    if (s.period === '7d' && day < daysAgo(6)) return false
    if (s.period === '30d' && day < daysAgo(29)) return false
    if (s.period === 'custom' && ((s.from && day < s.from) || (s.to && day > s.to))) return false
    if (s.assignee && t.assignee !== people.find((p) => String(p.id) === s.assignee)?.name)
      return false
    if (s.module) {
      const name = modules.find((m) => String(m.id) === s.module)?.name
      if (!name || !t.modules.includes(name)) return false
    }
    if (subj && !normalizeSearch(t.subject ?? '').includes(subj)) return false
    if (
      q &&
      ![t.protocol, t.contact.name, t.contact.phone.replace(/\D/g, ''), t.organization ?? ''].some(
        (f) => normalizeSearch(f).includes(q.replace(/[()\s-]/g, '') || q) || normalizeSearch(f).includes(q),
      )
    )
      return false
    return true
  })
}

const sortKeys: Record<string, (t: ProtoTicket) => string | number> = {
  protocolo: (t) => t.protocol,
  data: (t) => t.date.getTime(),
  contato: (t) => t.contact.name,
  orgao: (t) => t.organization ?? '',
  setor: (t) => t.sectorName,
  responsavel: (t) => t.assignee ?? '',
  assunto: (t) => t.subject ?? '',
  situacao: (t) => situationLabels[t.situation].label,
}

function useRows(s: ListState) {
  const filtered = applyFilters(s)
  const key = sortKeys[s.column] ?? sortKeys.data
  const sorted = [...filtered].sort((a, b) => {
    const x = key(a)
    const y = key(b)
    const c = typeof x === 'number' ? x - (y as number) : String(x).localeCompare(String(y), 'pt-BR')
    return s.direction === 'asc' ? c : -c
  })
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const page = Math.min(s.page, pages)
  return { rows: sorted.slice((page - 1) * pageSize, page * pageSize), total: sorted.length, page }
}

// ---------- peças comuns (células e campos) ----------

function formatWhen(d: Date) {
  const time = d.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  })
  if (brDay(d) === brDay(today)) return `Hoje ${time}`
  return `${d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })} ${time}`
}

function SituationPill({ t }: { t: ProtoTicket }) {
  const s = situationLabels[t.situation]
  return (
    <span className="flex flex-col gap-0.5">
      <Badge tone={s.tone}>{s.label}</Badge>
      {t.transferredTo && <span className="caption text-ink-faint">para {t.transferredTo}</span>}
    </span>
  )
}

function ModulesCell({ t }: { t: ProtoTicket }) {
  return t.modules.length ? (
    <span className="flex max-w-[105px] flex-col gap-1">
      {t.modules.map((m) => (
        <Badge key={m} variant="tag" className="block max-w-full truncate" title={m}>
          {m}
        </Badge>
      ))}
    </span>
  ) : (
    <span className="text-ink-faint">—</span>
  )
}

function Faint({ children }: { children: ReactNode }) {
  return <span className="text-ink-faint">{children}</span>
}

function RowLink({ t, children }: { t: ProtoTicket; children: ReactNode }) {
  return (
    <Link
      to={`/chamados/${t.id}`}
      className="body-strong underline-offset-2 after:absolute after:inset-0 hover:text-accent-strong hover:underline"
    >
      {children}
    </Link>
  )
}

function EmptyRows() {
  return (
    <Empty>
      <EmptyMedia>
        <Inbox strokeWidth={1.7} aria-hidden />
      </EmptyMedia>
      <EmptyDescription>Nenhum chamado encontrado.</EmptyDescription>
    </Empty>
  )
}

function Choose({
  id,
  label,
  allLabel,
  options,
  value,
  disabled,
  onChange,
  className,
}: {
  id: string
  label?: string
  allLabel: string
  options: { value: string; label: string }[]
  value: string | null
  disabled?: boolean
  onChange: (v: string | null) => void
  className?: string
}) {
  const items = [{ value: all, label: allLabel }, ...options]
  const select = (
    <Select
      items={items}
      value={value ?? all}
      disabled={disabled}
      onValueChange={(v) => v && onChange(v === all ? null : v)}
    >
      <SelectTrigger id={id} aria-label={label ? undefined : allLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
  return label ? (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {select}
    </Field>
  ) : (
    <div className={className}>{select}</div>
  )
}

function SubjectField({ s, id, label = true }: { s: ListState; id: string; label?: boolean }) {
  const scoped = s.sector
    ? allSubjects.filter((name) => tickets.some((t) => t.subject === name && t.sectorId === Number(s.sector)))
    : allSubjects
  const typed = normalizeSearch(s.subject.trim())
  const matches = scoped.filter((n) => normalizeSearch(n).includes(typed))
  const input = (
    <Autocomplete items={scoped} filteredItems={matches} value={s.subject} onValueChange={(v) => s.setSubject(v)}>
      <AutocompleteInput id={id} placeholder="Parte do assunto" aria-label={label ? undefined : 'Assunto'} />
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
  )
  return label ? (
    <Field className="w-full sm:w-[calc(220px*var(--text-scale))]">
      <FieldLabel htmlFor={id}>Assunto</FieldLabel>
      {input}
    </Field>
  ) : (
    input
  )
}

const sectorOptions = sectors.map((x) => ({ value: String(x.id), label: x.name }))
function assigneeOptions(s: ListState) {
  return people
    .filter((p) => s.sector && p.sectorId === Number(s.sector))
    .map((p) => ({ value: String(p.id), label: p.name }))
}
function moduleOptions(s: ListState) {
  return modules
    .filter((m) => s.sector && m.sectorId === Number(s.sector))
    .map((m) => ({ value: String(m.id), label: m.name }))
}
const situationOptions = situations.map((x) => ({ value: x, label: situationLabels[x].label }))

function PeriodChips({ s }: { s: ListState }) {
  return (
    <ToggleGroup
      aria-label="Período"
      value={[s.period]}
      onValueChange={(v: string[]) => v[0] && s.setPeriod(v[0] as Period)}
    >
      {periodChoices.map((c) => (
        <ToggleGroupItem key={c.value} value={c.value}>
          {c.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function DateRange({ s, prefix }: { s: ListState; prefix: string }) {
  if (s.period !== 'custom') return null
  return (
    <>
      <Field className="w-full sm:w-[calc(160px*var(--text-scale))]">
        <FieldLabel htmlFor={`${prefix}-de`}>Início</FieldLabel>
        <Input id={`${prefix}-de`} type="date" value={s.from} onChange={(e) => s.setDate('de', e.target.value)} />
      </Field>
      <Field className="w-full sm:w-[calc(160px*var(--text-scale))]">
        <FieldLabel htmlFor={`${prefix}-ate`}>Fim</FieldLabel>
        <Input id={`${prefix}-ate`} type="date" value={s.to} onChange={(e) => s.setDate('ate', e.target.value)} />
      </Field>
    </>
  )
}

const lockedHint = 'Escolha um setor'

// ---------- Versão A: barra de filtros acima da tabela ----------

function VariantA({ s }: { s: ListState }) {
  const { rows, total, page } = useRows(s)
  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchBox value={s.q} onChange={s.setQ} label="Buscar chamados" placeholder="Protocolo, contato, telefone ou órgão" />
          <PeriodChips s={s} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <DateRange s={s} prefix="a" />
          <Choose
            id="a-situacao"
            label="Situação"
            allLabel="Todas as situações"
            options={situationOptions}
            value={s.situations[0] ?? null}
            onChange={(v) => s.setSituations(v ? [v as Situation] : [])}
            className="w-full sm:w-[calc(190px*var(--text-scale))]"
          />
          {s.isAdmin && (
            <Choose
              id="a-setor"
              label="Setor"
              allLabel="Todos os setores"
              options={sectorOptions}
              value={s.sector}
              onChange={s.setSector}
              className="w-full sm:w-[calc(190px*var(--text-scale))]"
            />
          )}
          <Choose
            id="a-resp"
            label="Responsável"
            allLabel={s.sector ? 'Todos os responsáveis' : lockedHint}
            options={assigneeOptions(s)}
            value={s.assignee}
            disabled={!s.sector}
            onChange={s.setAssignee}
            className="w-full sm:w-[calc(190px*var(--text-scale))]"
          />
          <Choose
            id="a-modulo"
            label="Módulo"
            allLabel={s.sector ? 'Todos os módulos' : lockedHint}
            options={moduleOptions(s)}
            value={s.module}
            disabled={!s.sector}
            onChange={s.setModule}
            className="w-full sm:w-[calc(190px*var(--text-scale))]"
          />
          <SubjectField s={s} id="a-assunto" />
        </div>
      </div>
      <Card className="gap-0 py-0">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Protocolo" column="protocolo" list={s} />
                <SortableTableHead label="Data" column="data" list={s} />
                <SortableTableHead label="Contato" column="contato" list={s} />
                <SortableTableHead label="Órgão" column="orgao" list={s} />
                {s.isAdmin && <SortableTableHead label="Setor" column="setor" list={s} />}
                <SortableTableHead label="Responsável" column="responsavel" list={s} />
                <SortableTableHead label="Assunto" column="assunto" list={s} />
                <TableHead>Módulos</TableHead>
                <SortableTableHead label="Situação" column="situacao" list={s} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className="relative">
                  <TableCell className="mono-num caption whitespace-nowrap">
                    <RowLink t={t}>{t.protocol}</RowLink>
                  </TableCell>
                  <TableCell className="mono-num caption whitespace-nowrap">{formatWhen(t.date)}</TableCell>
                  <TableCell className="max-w-[120px]">
                    <p className="truncate">{t.contact.name}</p>
                    <p className="mono-num caption text-ink-faint">{t.contact.phone}</p>
                  </TableCell>
                  <TableCell className="max-w-[110px] truncate" title={t.organization ?? undefined}>{t.organization ?? <Faint>Não cadastrado</Faint>}</TableCell>
                  {s.isAdmin && <TableCell className="max-w-[110px] truncate">{t.sectorName}</TableCell>}
                  <TableCell className="max-w-[100px] truncate">{t.assignee ?? <Faint>—</Faint>}</TableCell>
                  <TableCell className="max-w-[110px] truncate" title={t.subject ?? undefined}>{t.subject ?? <Faint>—</Faint>}</TableCell>
                  <TableCell>
                    <ModulesCell t={t} />
                  </TableCell>
                  <TableCell>
                    <SituationPill t={t} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyRows />
        )}
        <Pagination page={page} pageSize={pageSize} total={total} noun={['chamado', 'chamados']} onPage={s.setPage} />
      </Card>
    </>
  )
}

// ---------- Versão B: filtros numa coluna lateral ----------

function VariantB({ s }: { s: ListState }) {
  const { rows, total, page } = useRows(s)
  const counts = applyFilters(s, true).reduce<Record<string, number>>((acc, t) => {
    acc[t.situation] = (acc[t.situation] ?? 0) + 1
    return acc
  }, {})
  const toggle = (x: Situation) =>
    s.setSituations(s.situations.includes(x) ? s.situations.filter((y) => y !== x) : [...s.situations, x])
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[calc(250px*var(--text-scale))_minmax(0,1fr)] scaled-text:grid-cols-1">
      <Card className="gap-4 p-4" role="region" aria-label="Filtros">
        <div className="flex items-center justify-between">
          <p className="title-section">Filtros</p>
          <Button variant="ghost" size="sm" onClick={s.clearAll}>
            Limpar
          </Button>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-2">Situação</legend>
          {situations.map((x) => (
            <label key={x} className="flex items-center gap-2">
              <Checkbox checked={s.situations.includes(x)} onCheckedChange={() => toggle(x)} />
              <span className="flex-1">{situationLabels[x].label}</span>
              <span className="mono-num caption text-ink-faint">{counts[x] ?? 0}</span>
            </label>
          ))}
        </fieldset>
        <Choose
          id="b-periodo"
          label="Período"
          allLabel="Todo o período"
          options={periodChoices.filter((c) => c.value !== 'all')}
          value={s.period === 'all' ? null : s.period}
          onChange={(v) => s.setPeriod((v ?? 'all') as Period)}
        />
        {s.period === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="Início" type="date" value={s.from} onChange={(e) => s.setDate('de', e.target.value)} />
            <Input aria-label="Fim" type="date" value={s.to} onChange={(e) => s.setDate('ate', e.target.value)} />
          </div>
        )}
        {s.isAdmin && (
          <Choose id="b-setor" label="Setor" allLabel="Todos os setores" options={sectorOptions} value={s.sector} onChange={s.setSector} />
        )}
        <Choose
          id="b-resp"
          label="Responsável"
          allLabel={s.sector ? 'Todos os responsáveis' : lockedHint}
          options={assigneeOptions(s)}
          value={s.assignee}
          disabled={!s.sector}
          onChange={s.setAssignee}
        />
        <Choose
          id="b-modulo"
          label="Módulo"
          allLabel={s.sector ? 'Todos os módulos' : lockedHint}
          options={moduleOptions(s)}
          value={s.module}
          disabled={!s.sector}
          onChange={s.setModule}
        />
        <Field>
          <FieldLabel htmlFor="b-assunto">Assunto</FieldLabel>
          <SubjectField s={s} id="b-assunto" label={false} />
        </Field>
      </Card>
      <Card className="min-w-0 gap-0 py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <SearchBox value={s.q} onChange={s.setQ} label="Buscar chamados" placeholder="Protocolo, contato, telefone ou órgão" />
          <p className="caption text-ink-soft">
            <span className="mono-num">{total}</span> {total === 1 ? 'chamado' : 'chamados'}
          </p>
        </div>
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Data" column="data" list={s} />
                <SortableTableHead label="Protocolo" column="protocolo" list={s} />
                <SortableTableHead label="Contato" column="contato" list={s} />
                <SortableTableHead label="Órgão" column="orgao" list={s} />
                {s.isAdmin && <SortableTableHead label="Setor" column="setor" list={s} />}
                <SortableTableHead label="Responsável" column="responsavel" list={s} />
                <SortableTableHead label="Assunto" column="assunto" list={s} />
                <TableHead>Módulos</TableHead>
                <SortableTableHead label="Situação" column="situacao" list={s} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className="relative">
                  <TableCell className="mono-num caption whitespace-nowrap text-ink-soft">{formatWhen(t.date)}</TableCell>
                  <TableCell className="mono-num caption whitespace-nowrap">
                    <RowLink t={t}>{t.protocol}</RowLink>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{t.contact.name}</TableCell>
                  <TableCell className="max-w-[170px] truncate">{t.organization ?? <Faint>Não cadastrado</Faint>}</TableCell>
                  {s.isAdmin && <TableCell className="max-w-[110px] truncate">{t.sectorName}</TableCell>}
                  <TableCell className="max-w-[100px] truncate">{t.assignee ?? <Faint>—</Faint>}</TableCell>
                  <TableCell className="max-w-[140px] truncate">{t.subject ?? <Faint>—</Faint>}</TableCell>
                  <TableCell>
                    <ModulesCell t={t} />
                  </TableCell>
                  <TableCell>
                    <SituationPill t={t} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyRows />
        )}
        <Pagination page={page} pageSize={pageSize} total={total} noun={['chamado', 'chamados']} onPage={s.setPage} />
      </Card>
    </div>
  )
}

// ---------- Versão C: abas de situação, filtros sob demanda ----------

function VariantC({ s, open, setOpen }: { s: ListState; open: boolean; setOpen: (v: boolean) => void }) {
  const { rows, total, page } = useRows(s)
  const base = applyFilters(s, true)
  const tab = s.situations[0] ?? all
  const chips: { label: string; clear: () => void }[] = []
  if (s.period !== 'all')
    chips.push({
      label:
        s.period === 'custom'
          ? `Datas: ${s.from || '…'} a ${s.to || '…'}`
          : periodChoices.find((c) => c.value === s.period)!.label,
      clear: () => s.setPeriod('all'),
    })
  if (s.isAdmin && s.sector)
    chips.push({ label: `Setor: ${sectors.find((x) => String(x.id) === s.sector)?.name}`, clear: () => s.setSector(null) })
  if (s.assignee)
    chips.push({ label: `Responsável: ${people.find((p) => String(p.id) === s.assignee)?.name}`, clear: () => s.setAssignee(null) })
  if (s.module)
    chips.push({ label: `Módulo: ${modules.find((m) => String(m.id) === s.module)?.name}`, clear: () => s.setModule(null) })
  if (s.subject.trim()) chips.push({ label: `Assunto: ${s.subject}`, clear: () => s.setSubject('') })

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => s.setSituations(v === all ? [] : [v as Situation])}>
        <TabsList>
          <TabsTrigger value={all}>
            Todos <span className="mono-num text-ink-faint">{base.length}</span>
          </TabsTrigger>
          {situations.map((x) => (
            <TabsTrigger key={x} value={x}>
              {situationLabels[x].label}{' '}
              <span className="mono-num text-ink-faint">{base.filter((t) => t.situation === x).length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={s.q} onChange={s.setQ} label="Buscar chamados" placeholder="Protocolo, contato, telefone ou órgão" />
        <Button variant={open ? 'default' : 'outline'} onClick={() => setOpen(!open)} aria-expanded={open}>
          <SlidersHorizontal strokeWidth={1.7} aria-hidden />
          Filtros{chips.length ? ` (${chips.length})` : ''}
        </Button>
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.clear}
            aria-label={`Tirar filtro ${c.label}`}
            className="caption inline-flex items-center gap-1 rounded-(--radius-pill) border border-line bg-card px-2.5 py-1 text-ink-soft hover:text-ink"
          >
            {c.label}
            <X strokeWidth={1.7} className="size-3" aria-hidden />
          </button>
        ))}
        {chips.length > 1 && (
          <Button variant="ghost" size="sm" onClick={s.clearAll}>
            Limpar tudo
          </Button>
        )}
      </div>
      {open && (
        <Card className="gap-3 p-4">
          <PeriodChips s={s} />
          <div className="flex flex-wrap items-end gap-3">
            <DateRange s={s} prefix="c" />
            {s.isAdmin && (
              <Choose id="c-setor" label="Setor" allLabel="Todos os setores" options={sectorOptions} value={s.sector} onChange={s.setSector} className="w-full sm:w-[calc(190px*var(--text-scale))]" />
            )}
            <Choose
              id="c-resp"
              label="Responsável"
              allLabel={s.sector ? 'Todos os responsáveis' : lockedHint}
              options={assigneeOptions(s)}
              value={s.assignee}
              disabled={!s.sector}
              onChange={s.setAssignee}
              className="w-full sm:w-[calc(190px*var(--text-scale))]"
            />
            <Choose
              id="c-modulo"
              label="Módulo"
              allLabel={s.sector ? 'Todos os módulos' : lockedHint}
              options={moduleOptions(s)}
              value={s.module}
              disabled={!s.sector}
              onChange={s.setModule}
              className="w-full sm:w-[calc(190px*var(--text-scale))]"
            />
            <SubjectField s={s} id="c-assunto" />
          </div>
        </Card>
      )}
      <Card className="gap-0 py-0">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Situação" column="situacao" list={s} />
                <SortableTableHead label="Protocolo" column="protocolo" list={s} />
                <SortableTableHead label="Data" column="data" list={s} />
                <SortableTableHead label="Contato" column="contato" list={s} />
                <SortableTableHead label="Órgão" column="orgao" list={s} />
                {s.isAdmin && <SortableTableHead label="Setor" column="setor" list={s} />}
                <SortableTableHead label="Assunto" column="assunto" list={s} />
                <TableHead>Módulos</TableHead>
                <SortableTableHead label="Responsável" column="responsavel" list={s} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow
                  key={t.id}
                  className={cn('relative', (t.situation === 'cancelled' || t.situation === 'transferred') && 'text-ink-soft')}
                >
                  <TableCell>
                    <SituationPill t={t} />
                  </TableCell>
                  <TableCell className="mono-num caption whitespace-nowrap">
                    <RowLink t={t}>{t.protocol}</RowLink>
                  </TableCell>
                  <TableCell className="mono-num caption whitespace-nowrap">{formatWhen(t.date)}</TableCell>
                  <TableCell className="max-w-[120px]">
                    <p className="body-strong truncate">{t.contact.name}</p>
                    <p className="mono-num caption text-ink-faint">{t.contact.phone}</p>
                  </TableCell>
                  <TableCell className="max-w-[110px] truncate" title={t.organization ?? undefined}>{t.organization ?? <Faint>Não cadastrado</Faint>}</TableCell>
                  {s.isAdmin && <TableCell className="max-w-[110px] truncate">{t.sectorName}</TableCell>}
                  <TableCell className="max-w-[110px] truncate" title={t.subject ?? undefined}>{t.subject ?? <Faint>—</Faint>}</TableCell>
                  <TableCell>
                    <ModulesCell t={t} />
                  </TableCell>
                  <TableCell className="max-w-[100px] truncate">{t.assignee ?? <Faint>—</Faint>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyRows />
        )}
        <Pagination page={page} pageSize={pageSize} total={total} noun={['chamado', 'chamados']} onPage={s.setPage} />
      </Card>
    </>
  )
}

// ---------- barra do protótipo ----------

const variants = [
  ['A', 'A (barra de filtros)'],
  ['B', 'B (filtros na lateral)'],
  ['C', 'C (abas de situação)'],
] as const

function PrototypeSwitcher({ current }: { current: string }) {
  const [, setParams] = useSearchParams()
  const index = Math.max(0, variants.findIndex(([v]) => v === current))
  const go = (step: number) => {
    const next = variants[(index + step + variants.length) % variants.length][0]
    setParams((p) => {
      const copy = new URLSearchParams(p)
      copy.set('variant', next)
      return copy
    })
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = document.activeElement
      if (el && (el.matches('input, textarea') || (el as HTMLElement).isContentEditable)) return
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (!import.meta.env.DEV) return null
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full border-2 border-dashed border-black bg-yellow-300 px-3 py-1.5 font-mono text-sm text-black shadow-lg">
      <button type="button" aria-label="Versão anterior" onClick={() => go(-1)}>
        ←
      </button>
      <span>Protótipo #164 · {variants[index][1]}</span>
      <button type="button" aria-label="Próxima versão" onClick={() => go(1)}>
        →
      </button>
    </div>
  )
}

export default function AtendimentoPrototype() {
  const { data: user } = useCurrentUser()
  const [params, setParams] = useSearchParams()
  const variant = params.get('variant') ?? 'A'
  const s = useListState(user?.role === 'admin')
  const filtersOpen = params.get('filtros') === '1'
  const setFiltersOpen = (v: boolean) =>
    setParams((p) => {
      const copy = new URLSearchParams(p)
      if (v) copy.set('filtros', '1')
      else copy.delete('filtros')
      return copy
    })
  if (!user) return null
  return (
    <>
      <Topbar breadcrumb={s.isAdmin ? 'Todos os setores' : 'Suporte Sistemas'} title="Atendimento" />
      <PageContent>
        {variant === 'A' && <VariantA s={s} />}
        {variant === 'B' && <VariantB s={s} />}
        {variant === 'C' && <VariantC s={s} open={filtersOpen} setOpen={setFiltersOpen} />}
      </PageContent>
      <PrototypeSwitcher current={variant} />
    </>
  )
}

