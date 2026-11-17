// PROTÓTIPO #237 (descartável): imagem aberta por cima da conversa, com zoom.
// Uma versão só (ajuste de tela existente). Sem testes; a implementação reescreve.
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ExternalLink, Maximize, Minus, Plus, X } from 'lucide-react'
import { useRef, useState, type PointerEvent, type WheelEvent } from 'react'

import { Button } from '@/components/ui/button'

const MIN = 1
const MAX = 5
const STEP = 0.5

export function ImageViewerPrototype({ src }: { src: string }) {
  const [open, setOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const zoomTo = (next: number) => {
    const s = Math.min(MAX, Math.max(MIN, next))
    setScale(s)
    if (s === 1) setOffset({ x: 0, y: 0 })
  }
  const reset = () => zoomTo(1)

  const onWheel = (e: WheelEvent) => zoomTo(scale + (e.deltaY < 0 ? 0.25 : -0.25))
  const onPointerDown = (e: PointerEvent) => {
    if (scale === 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!drag.current) return
    setOffset({
      x: drag.current.ox + e.clientX - drag.current.x,
      y: drag.current.oy + e.clientY - drag.current.y,
    })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogPrimitive.Trigger
        render={
          <button
            type="button"
            aria-label="Ampliar imagem"
            className="cursor-zoom-in rounded-(--radius-8)"
          />
        }
      >
        <img
          src={src}
          alt="Imagem"
          loading="lazy"
          className="max-h-72 max-w-full rounded-(--radius-8) border border-line-soft bg-muted object-contain"
        />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/85" />
        <DialogPrimitive.Popup
          aria-label="Imagem ampliada"
          className="fixed inset-0 z-50 flex flex-col outline-none"
        >
          <div className="relative z-10 flex items-center justify-end gap-1 bg-black/70 p-3 text-white">
            <span className="mono-num caption mr-2 text-white/80">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="icon" aria-label="Diminuir zoom" className="text-white hover:bg-white/10" onClick={() => zoomTo(scale - STEP)} disabled={scale <= MIN}>
              <Minus />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Aumentar zoom" className="text-white hover:bg-white/10" onClick={() => zoomTo(scale + STEP)} disabled={scale >= MAX}>
              <Plus />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Ajustar à tela" className="text-white hover:bg-white/10" onClick={reset}>
              <Maximize />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Abrir original em nova guia"
              className="text-white hover:bg-white/10"
              nativeButton={false}
              render={<a href={src} target="_blank" rel="noopener" />}
            >
              <ExternalLink />
            </Button>
            <DialogPrimitive.Close
              render={
                <Button variant="ghost" size="icon" aria-label="Fechar" className="text-white hover:bg-white/10" />
              }
            >
              <X />
            </DialogPrimitive.Close>
          </div>
          {/* Clique na área vazia fecha; na imagem, não. */}
          <div
            className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false)
            }}
            onWheel={onWheel}
          >
            <img
              src={src}
              alt="Imagem ampliada"
              draggable={false}
              onDoubleClick={() => (scale === 1 ? zoomTo(2) : reset())}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
              className={`max-h-full max-w-full select-none object-contain transition-transform duration-75 ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
            />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
