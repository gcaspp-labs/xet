// PROTÓTIPO #342 — descartável, não vai para a main.
// Plano: três posições do quadro Pendentes no Dashboard novo (o da #223 aprovada:
// sem cards de número, listas de cinco itens por página com paginação, TOTAL no
// rodapé e Recebidos/Tempo médio em "Do setor"), trocáveis por ?variante=A|B|C.
// O quadro mostra a quantidade de pendentes e os 10 parados há mais tempo
// (spec #332): contato, protocolo, motivo e há quanto tempo; a linha abre o
// chamado e "Ver todos" abre a aba Pendentes da #337.
import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CirclePause } from 'lucide-react'
import { Link } from 'react-router'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'

export type Pendente = {
  id: number
  protocol: string
  contact: { name: string }
  reason: string
  since: string
  sector: { id: number; name: string }
}

type Pendentes = { count: number; items: Pendente[] }

const hrefVerTodos = '/chamados?aba=pendentes&prototype=337'
const hrefLinha = (id: number) => `/chamados/${id}?prototype=337&estado=pendente`

function elapsed(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
  const dias = Math.floor(min / 1440)
  return dias === 1 ? '1 dia' : `${dias} dias`
}

function usePendentes(search: string) {
  return useQuery({
    queryKey: ['dashboard', 'pending', search],
    queryFn: () => api<Pendentes>(`/dashboard/pending?${search}`),
  })
}

// Mesmo destaque das listas ao vivo (#223): a quantidade entre parênteses.
function Count({ value }: { value: number }) {
  return <span className="mono-num font-semibold text-accent-strong">({value})</span>
}

function VerTodos() {
  return (
    <Link
      to={hrefVerTodos}
      className="caption inline-flex items-center gap-1 whitespace-nowrap text-accent-strong underline-offset-2 hover:underline"
    >
      Ver todos <ArrowRight className="size-3.5" strokeWidth={1.7} aria-hidden />
    </Link>
  )
}

function Vazio() {
  return (
    <Empty>
      <EmptyMedia>
        <CirclePause strokeWidth={1.7} aria-hidden />
      </EmptyMedia>
      <EmptyDescription>Nenhum chamado pendente</EmptyDescription>
    </Empty>
  )
}

function Nota() {
  return (
    <p className="caption border-t border-line-soft px-5 py-3 text-ink-faint">
      Ao vivo. O período não muda o quadro; os 10 parados há mais tempo, primeiro.
    </p>
  )
}

// A: terceiro quadro, abaixo de Fila e Em atendimento, na tabela.
export function PendingA({ search, admin }: { search: string; admin: boolean }) {
  const { data } = usePendentes(search)
  const items = data?.items ?? []
  return (
    <Card role="region" aria-labelledby="board-pending-title">
      <CardHeader className="bg-muted">
        <CardTitle id="board-pending-title">
          Pendentes {data && <Count value={data.count} />}
        </CardTitle>
        <CardDescription>Os 10 parados há mais tempo</CardDescription>
        <CardAction>
          <VerTodos />
        </CardAction>
      </CardHeader>
      {!data || items.length === 0 ? (
        <Vazio />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px] body-strong text-ink">Chamado</TableHead>
                <TableHead className="body-strong text-ink">Motivo</TableHead>
                {admin && <TableHead className="w-[180px] body-strong text-ink">Setor</TableHead>}
                <TableHead className="w-[120px] body-strong text-right text-ink">
                  Parado há
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.slice(0, 10).map((pendente) => (
                <TableRow key={pendente.id} className="relative">
                  <TableCell className="w-[260px] max-w-0 whitespace-normal">
                    <Link
                      to={hrefLinha(pendente.id)}
                      className="body-strong underline-offset-2 after:absolute after:inset-0 hover:text-accent-strong hover:underline"
                    >
                      {pendente.contact.name}
                    </Link>
                    <p className="caption mono-num text-ink-faint">{pendente.protocol}</p>
                  </TableCell>
                  <TableCell className="max-w-0 whitespace-normal">
                    <p className="body">{pendente.reason}</p>
                  </TableCell>
                  {admin && <TableCell className="w-[180px]">{pendente.sector.name}</TableCell>}
                  <TableCell className="w-[120px] whitespace-nowrap text-right">
                    <p className="mono-num">{elapsed(pendente.since)}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Nota />
        </>
      )}
    </Card>
  )
}

// B: faixa no topo, abaixo dos filtros e antes de "Agora", em duas colunas.
export function PendingB({ search, admin }: { search: string; admin: boolean }) {
  const { data } = usePendentes(search)
  const items = data?.items ?? []
  return (
    <Card role="region" aria-labelledby="board-pending-title">
      <CardHeader>
        <CardTitle id="board-pending-title">
          Pendentes {data && <Count value={data.count} />}
        </CardTitle>
        <CardDescription>Os 10 parados há mais tempo, antes de tudo</CardDescription>
        <CardAction>
          <VerTodos />
        </CardAction>
      </CardHeader>
      {!data || items.length === 0 ? (
        <Vazio />
      ) : (
        <>
          <div className="grid gap-x-8 px-5 lg:grid-cols-2">
            {items.slice(0, 10).map((pendente) => (
              <div key={pendente.id} className="relative border-b border-line-soft py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    to={hrefLinha(pendente.id)}
                    className="body-strong underline-offset-2 after:absolute after:inset-0 hover:text-accent-strong hover:underline"
                  >
                    {pendente.contact.name}
                  </Link>
                  <span className="mono-num caption shrink-0 whitespace-nowrap text-ink-soft">
                    {elapsed(pendente.since)}
                  </span>
                </div>
                <p className="caption text-ink-faint">
                  <span className="mono-num">{pendente.protocol}</span>
                  {admin && ` · ${pendente.sector.name}`}
                </p>
                <p className="body mt-1">{pendente.reason}</p>
              </div>
            ))}
          </div>
          <Nota />
        </>
      )}
    </Card>
  )
}

// C: coluna à direita das listas ao vivo, em linhas compactas.
export function PendingC({ search, admin }: { search: string; admin: boolean }) {
  const { data } = usePendentes(search)
  const items = data?.items ?? []
  return (
    <Card role="region" aria-labelledby="board-pending-title" className="lg:sticky lg:top-4">
      <CardHeader className="bg-muted">
        <CardTitle id="board-pending-title">
          Pendentes {data && <Count value={data.count} />}
        </CardTitle>
        <CardAction>
          <VerTodos />
        </CardAction>
      </CardHeader>
      {!data || items.length === 0 ? (
        <Vazio />
      ) : (
        <>
          <div>
            {items.slice(0, 10).map((pendente) => (
              <div
                key={pendente.id}
                className="relative border-b border-line-soft px-5 py-3 last:border-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    to={hrefLinha(pendente.id)}
                    className="body-strong underline-offset-2 after:absolute after:inset-0 hover:text-accent-strong hover:underline"
                  >
                    {pendente.contact.name}
                  </Link>
                  <span className="mono-num caption shrink-0 whitespace-nowrap text-ink-soft">
                    {elapsed(pendente.since)}
                  </span>
                </div>
                <p className="caption truncate text-ink-faint">
                  <span className="mono-num">{pendente.protocol}</span>
                  {admin && ` · ${pendente.sector.name}`}
                </p>
                <p className="caption mt-1 line-clamp-2">{pendente.reason}</p>
              </div>
            ))}
          </div>
          <Nota />
        </>
      )}
    </Card>
  )
}

// Barra do protótipo: versão, papel, estado e tema; some nas capturas e no build.
export type Variante = 'A' | 'B' | 'C'

const variantes: { value: Variante; label: string }[] = [
  { value: 'A', label: 'A terceiro quadro' },
  { value: 'B', label: 'B faixa no topo' },
  { value: 'C', label: 'C coluna à direita' },
]

function trocar(chave: string, valor: string) {
  const params = new URLSearchParams(window.location.search)
  if (valor) params.set(chave, valor)
  else params.delete(chave)
  params.set('prototype', '342')
  window.location.search = params.toString()
}

function Botao({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        ativo
          ? 'border-accent bg-accent text-on-accent'
          : 'border-line bg-surface text-ink-soft hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function Prototype342Bar({ variante }: { variante: Variante }) {
  if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('captura') === '1')
    return null
  const params = new URLSearchParams(window.location.search)
  const papel = params.get('as') === 'admin' ? 'admin' : 'supervisor'
  const estado = params.get('pendentes') === 'vazio' ? 'vazio' : 'normal'
  const tema = params.get('tema') ?? 'claro'
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-surface/95 px-3 py-1.5 shadow-lg backdrop-blur">
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        {variantes.map((item) => (
          <Botao
            key={item.value}
            ativo={variante === item.value}
            onClick={() => trocar('variante', item.value)}
          >
            {item.label}
          </Botao>
        ))}
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        <Botao ativo={papel === 'supervisor'} onClick={() => trocar('as', 'supervisor')}>
          Supervisor
        </Botao>
        <Botao ativo={papel === 'admin'} onClick={() => trocar('as', 'admin')}>
          Administrador
        </Botao>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        <Botao ativo={estado === 'normal'} onClick={() => trocar('pendentes', '')}>
          Com pendentes
        </Botao>
        <Botao ativo={estado === 'vazio'} onClick={() => trocar('pendentes', 'vazio')}>
          Sem pendentes
        </Botao>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />
        {['claro', 'escuro', 'contraste'].map((item) => (
          <Botao key={item} ativo={tema === item} onClick={() => trocar('tema', item)}>
            {item}
          </Botao>
        ))}
      </div>
    </div>
  )
}
