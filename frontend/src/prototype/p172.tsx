// PROTÓTIPO #172 (rodada 2), descartável, não vai para a main.
// Plano: duas versões da tela Conversas abaixo de xl, trocadas por `?variant=` (A ou B)
// em /conversas e /conversas/:id. Nas duas a página fica fixa na altura da janela e só as
// listas e o histórico rolam. Em xl+ as duas são iguais (três colunas, como já aprovado).
//   A (uma coluna por vez): abaixo de xl, um seletor Meus | Conversa | Fila mostra um bloco.
//   B (duas colunas): de lg a xl, listas empilhadas à esquerda e conversa à direita;
//     abaixo de lg (tablet e celular), um bloco por vez, como a A.
// `?cabecalho=178` simula o cabeçalho previsto na #178 (Encerrar + ⋯, "+" em Meus atendimentos).
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router'

export const variants = [
  { id: 'A', label: 'A (uma coluna por vez abaixo de xl)' },
  { id: 'B', label: 'B (duas colunas de lg a xl; uma abaixo de lg)' },
] as const
export type Variant = 'A' | 'B'

export function useVariant(): Variant {
  const [params] = useSearchParams()
  return params.get('variant') === 'B' ? 'B' : 'A'
}

export function useHeader178() {
  const [params] = useSearchParams()
  return params.get('cabecalho') === '178'
}

// Barra do protótipo: fora do design avaliado, de propósito (rosa, monoespaçada).
export function PrototypeSwitcher() {
  const { pathname } = useLocation()
  const [params, setParams] = useSearchParams()
  const current = Math.max(
    0,
    variants.findIndex((v) => v.id === (params.get('variant') ?? 'A')),
  )
  const go = (step: number) => {
    const next = variants[(current + step + variants.length) % variants.length]
    const p = new URLSearchParams(params)
    p.set('variant', next.id)
    setParams(p, { replace: true })
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
  if (import.meta.env.PROD || !pathname.startsWith('/conversas') || params.get('captura') === '1')
    return null
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
        font: '600 12px monospace',
        boxShadow: '0 4px 16px rgba(0,0,0,.35)',
        whiteSpace: 'nowrap',
      }}
    >
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Versão anterior"
        style={{ color: '#fff' }}
      >
        <ChevronLeft size={16} />
      </button>
      <span>#172 · {variants[current].label}</span>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Próxima versão"
        style={{ color: '#fff' }}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
