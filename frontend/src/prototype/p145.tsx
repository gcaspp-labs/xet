// PROTÓTIPO #145 — descartável, não vai para a main.
// Plano: uma proposta da tela nova Conversas, em /conversas e /conversas/:id,
// com os estados trocados pela barra rosa (ou ← →). `?variant=atual` mostra a main.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router'

const variants = ['proposta', 'atual'] as const
type Variant = (typeof variants)[number]

export function useVariant(): Variant {
  const [params] = useSearchParams()
  return params.get('variant') === 'atual' ? 'atual' : 'proposta'
}

export function useIsProposal() {
  return useVariant() === 'proposta'
}

// Barra do protótipo: fica fora do design avaliado, de propósito.
// Uma proposta só (o layout veio do desenho de Laboratório); a barra troca os estados da tela.
const states = [
  { label: 'Conversa aberta · aba Fila', url: '/conversas/101' },
  { label: 'Conversa aberta · aba Assuntos (contador na Fila)', url: '/conversas/101?aba=assuntos' },
  { label: 'Sem conversa · Selecione um atendimento', url: '/conversas' },
  { label: 'Sem conversa · Sem atendimentos disponíveis', url: '/conversas?vazio=1' },
]

export function PrototypeSwitcher() {
  const { pathname, search } = useLocation()
  const here = pathname + search
  const current = states.findIndex((s) => s.url === here)
  const go = (step: number) => {
    const i = ((current < 0 ? 0 : current) + step + states.length) % states.length
    // Recarrega: a API falsa lê ?vazio=1 ao abrir.
    window.location.assign(states[i].url)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (import.meta.env.PROD || !pathname.startsWith('/conversas')) return null
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
        background: '#ff00aa',
        color: '#fff',
        borderRadius: 999,
        font: '600 13px monospace',
        boxShadow: '0 4px 16px rgba(0,0,0,.35)',
      }}
    >
      <button type="button" onClick={() => go(-1)} aria-label="Estado anterior" style={{ color: '#fff' }}>
        <ChevronLeft size={16} />
      </button>
      <span>PROTÓTIPO #145 · {current < 0 ? 'navegando' : states[current].label}</span>
      <button type="button" onClick={() => go(1)} aria-label="Próximo estado" style={{ color: '#fff' }}>
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
