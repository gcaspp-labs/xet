// PROTÓTIPO #263: barra flutuante (←/→) que troca a escala de cinza. Some no build de produção.
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import './gray263.css'

const variants = [
  ['B', 'B (proposta: cinzas zinc)'],
  ['atual', 'Atual (tokens de hoje)'],
] as const

export function PrototypeSwitcher263() {
  const [params, setParams] = useSearchParams()
  const current = Math.max(0, variants.findIndex(([v]) => v === params.get('variant')))
  useEffect(() => {
    document.documentElement.dataset.protoGray = variants[current][0]
  }, [current])
  const go = (step: number) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      next.set('variant', variants[(current + step + variants.length) % variants.length][0])
      return next
    }, { replace: true })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.matches('input, textarea') || el.isContentEditable)) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (import.meta.env.PROD) return null
  return (
    <div
      data-prototype-bar
      style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#ff00aa', color: '#fff', borderRadius: 999, padding: '6px 14px', display: 'flex', gap: 12, alignItems: 'center', font: '600 13px monospace', boxShadow: '0 4px 16px rgba(0,0,0,.35)' }}
    >
      <button type="button" onClick={() => go(-1)} aria-label="Versão anterior">←</button>
      <span>PROTÓTIPO #263 · {variants[current][1]}</span>
      <button type="button" onClick={() => go(1)} aria-label="Próxima versão">→</button>
    </div>
  )
}
