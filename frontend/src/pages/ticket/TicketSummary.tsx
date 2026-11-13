// PROTÓTIPO #162 — descartável, não vai para a main.
// Uma versão (ajuste de tela existente): faixa de resumo no topo de /chamados/:id, acima
// da lista, da conversa e do painel com as abas. Dados fictícios em src/prototype/fakeApi.ts.
// A barra no rodapé troca entre os chamados de exemplo (101 a 105).
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { type TicketDetail, useTicketModules } from '@/lib/conversation'
import { formatPhone, ticketStatusLabel } from '@/lib/format'

// Altura reservada para a faixa: as colunas de baixo descontam esse valor para
// a conversa continuar cabendo na tela sem rolar a página.
export const summaryHeight = '142px'

function Item({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="label text-ink-soft">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

const pending = (text: string) => <span className="text-ink-faint">{text}</span>

export function TicketSummary({ ticket }: { ticket: TicketDetail }) {
  const closed = ticket.status === 'closed'
  const cancelled = ticket.closureType === 'cancelled'
  const transferred = ticket.closureType === 'transferred'
  const { data: modules = [] } = useTicketModules(ticket.id, closed && !cancelled)
  const [expanded, setExpanded] = useState(false)
  const status = transferred
    ? { label: 'Transferido', tone: 'neutral' as const }
    : ticketStatusLabel(ticket.status, ticket.closureType)

  // Aberto: assunto, resolução e módulos só existem depois do encerramento.
  // Cancelado: não lança o atendimento, então não tem esses dados.
  const missing = cancelled ? 'Não se aplica' : 'Preenchido ao encerrar'

  return (
    <Card
      role="region"
      aria-label="Resumo do chamado"
      className="px-5 py-4 lg:col-span-2 xl:col-span-3"
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Item label="Protocolo">
          <span className="mono-num">{ticket.protocol}</span>
        </Item>
        <Item label="Situação">
          <Badge tone={status.tone}>{status.label}</Badge>
          {ticket.next && (
            <span className="caption block text-ink-faint">
              para {ticket.next.sectorName} ·{' '}
              <span className="mono-num">{ticket.next.protocol}</span>
            </span>
          )}
        </Item>
        <Item label="Contato">
          <span className="block truncate">{ticket.contact.name}</span>
          <span className="mono-num caption block whitespace-nowrap text-ink-faint">
            {ticket.contact.phone ? formatPhone(ticket.contact.phone) : 'Sem telefone'}
          </span>
        </Item>
        <Item label="Órgão">
          {ticket.organization ? (
            <>
              <span className="block truncate" title={ticket.organization.name}>
                {ticket.organization.name}
              </span>
              <span className="caption block truncate text-ink-faint">
                {ticket.organization.municipality.name}
              </span>
            </>
          ) : (
            pending('Não cadastrado')
          )}
        </Item>
        <Item label="Setor">{ticket.sector.name}</Item>
        <Item label="Responsável">{ticket.assignee?.name ?? pending('Sem responsável')}</Item>
        <Item label="Módulos" className="xl:col-span-2">
          {modules.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {modules.map((module) => (
                <Badge key={module.id} variant="tag">
                  {module.name}
                </Badge>
              ))}
            </span>
          ) : (
            pending(missing)
          )}
        </Item>
        <Item label="Assunto">{ticket.subject ?? pending(missing)}</Item>
        <Item label="Resolução" className="col-span-2 md:col-span-3">
          {ticket.resolution ? (
            <div className="flex items-start gap-2">
              <p
                className={
                  expanded ? 'min-w-0 flex-1 whitespace-pre-wrap break-words' : 'min-w-0 flex-1 truncate'
                }
              >
                {ticket.resolution}
              </p>
              {ticket.resolution.length > 90 && (
                <button
                  type="button"
                  className="shrink-0 text-primary hover:underline"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded ? 'Ver menos' : 'Ver tudo'}
                </button>
              )}
            </div>
          ) : (
            pending(missing)
          )}
        </Item>
      </dl>
    </Card>
  )
}

// Barra do protótipo: alterna entre os chamados de exemplo. Some no build de produção.
const examples = [
  { id: 101, label: '101 em atendimento' },
  { id: 102, label: '102 na fila' },
  { id: 103, label: '103 encerrado' },
  { id: 104, label: '104 transferido' },
  { id: 105, label: '105 cancelado' },
]

export function PrototypeSwitcher({ current }: { current: number }) {
  const navigate = useNavigate()
  const index = Math.max(
    0,
    examples.findIndex((example) => example.id === current),
  )
  const go = (step: number) =>
    navigate(`/chamados/${examples[(index + step + examples.length) % examples.length].id}`)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (import.meta.env.PROD) return null
  return (
    <div
      data-prototype-switcher
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 999,
        background: 'repeating-linear-gradient(45deg, #222, #222 6px, #333 6px, #333 12px)',
        color: '#ff0',
        font: '12px monospace',
      }}
    >
      <button type="button" aria-label="Chamado anterior" onClick={() => go(-1)}>
        <ChevronLeft size={16} />
      </button>
      PROTÓTIPO #162 · {examples[index].label}
      <button type="button" aria-label="Próximo chamado" onClick={() => go(1)}>
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
