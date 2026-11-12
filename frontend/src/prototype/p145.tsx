// PROTÓTIPO #145 — descartável, não vai para a main.
// Plano: uma versão (ajuste de telas existentes), comparável com a tela de hoje,
// trocada por `?variant=proposta|atual` em /, /conversas e /chamados/:id.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

const variants = ['proposta', 'atual'] as const
type Variant = (typeof variants)[number]
const labels: Record<Variant, string> = {
  proposta: 'Proposta (#145)',
  atual: 'Atual (main)',
}

export function useVariant(): Variant {
  const [params] = useSearchParams()
  return params.get('variant') === 'atual' ? 'atual' : 'proposta'
}

export function useIsProposal() {
  return useVariant() === 'proposta'
}

// Barra do protótipo: fica fora do design avaliado, de propósito.
export function PrototypeSwitcher() {
  const [params, setParams] = useSearchParams()
  const current = useVariant()
  const go = (step: number) => {
    const i = (variants.indexOf(current) + step + variants.length) % variants.length
    const next = new URLSearchParams(params)
    next.set('variant', variants[i])
    setParams(next, { replace: true })
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
        background: '#ff00aa',
        color: '#fff',
        borderRadius: 999,
        font: '600 13px monospace',
        boxShadow: '0 4px 16px rgba(0,0,0,.35)',
      }}
    >
      <button type="button" onClick={() => go(-1)} aria-label="Versão anterior" style={{ color: '#fff' }}>
        <ChevronLeft size={16} />
      </button>
      <span>PROTÓTIPO · {labels[current]}</span>
      <button type="button" onClick={() => go(1)} aria-label="Próxima versão" style={{ color: '#fff' }}>
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
