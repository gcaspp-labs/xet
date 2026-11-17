import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ExternalLink, Maximize, Minus, Plus, X } from 'lucide-react'
import { type PointerEvent, type WheelEvent, useRef, useState } from 'react'

import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogClose } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const MIN_ZOOM = 1
const MAX_ZOOM = 5
const BUTTON_STEP = 0.5
const WHEEL_STEP = 0.25
const DOUBLE_CLICK_ZOOM = 2

type View = { scale: number; x: number; y: number }

const initialView: View = { scale: MIN_ZOOM, x: 0, y: 0 }

const barButton = 'text-on-overlay hover:bg-on-overlay/15 hover:text-on-overlay'

// Imagem da conversa: a miniatura abre o visualizador por cima da tela, com zoom
// pela roda e pelos botões, arrastar quando ampliada e o original em nova guia.
export function ImageViewer({ src }: { src: string }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>(initialView)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null)

  const zoomBy = (delta: number) => setView((current) => zoomTo(current, current.scale + delta))
  const fit = () => setView(initialView)

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      drag.current = null
      setDragging(false)
      setView(initialView)
    }
  }

  const onWheel = (event: WheelEvent) => zoomBy(event.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP)
  const onPointerDown = (event: PointerEvent) => {
    if (view.scale === MIN_ZOOM) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, originX: view.x, originY: view.y }
    setDragging(true)
  }
  const onPointerMove = (event: PointerEvent) => {
    const start = drag.current
    if (!start) return
    setView((current) => ({
      ...current,
      x: start.originX + event.clientX - start.x,
      y: start.originY + event.clientY - start.y,
    }))
  }
  const onPointerUp = () => {
    drag.current = null
    setDragging(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-(--overlay)" />
        <DialogPrimitive.Popup
          aria-label="Imagem ampliada"
          className="fixed inset-0 z-50 flex flex-col outline-none"
        >
          <div className="relative z-10 flex items-center justify-end gap-1 bg-(--overlay) p-3 text-on-overlay">
            <span className="mono-num caption mr-2" aria-label="Zoom atual">
              {Math.round(view.scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Diminuir zoom"
              className={barButton}
              disabled={view.scale <= MIN_ZOOM}
              onClick={() => zoomBy(-BUTTON_STEP)}
            >
              <Minus />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Aumentar zoom"
              className={barButton}
              disabled={view.scale >= MAX_ZOOM}
              onClick={() => zoomBy(BUTTON_STEP)}
            >
              <Plus />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ajustar à tela"
              className={barButton}
              onClick={fit}
            >
              <Maximize />
            </Button>
            <a
              href={src}
              target="_blank"
              rel="noopener"
              aria-label="Abrir original em nova guia"
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), barButton)}
            >
              <ExternalLink />
            </a>
            <DialogClose
              render={
                <Button variant="ghost" size="icon" aria-label="Fechar" className={barButton} />
              }
            >
              <X />
            </DialogClose>
          </div>
          {/* Clique na área vazia fecha; na imagem, não. */}
          <div
            className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6"
            onClick={(event) => {
              if (event.target === event.currentTarget) onOpenChange(false)
            }}
            onWheel={onWheel}
          >
            <img
              src={src}
              alt="Imagem ampliada"
              draggable={false}
              onDoubleClick={() =>
                setView((current) =>
                  zoomTo(current, current.scale === MIN_ZOOM ? DOUBLE_CLICK_ZOOM : MIN_ZOOM),
                )
              }
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
              className={cn(
                'max-h-full max-w-full object-contain select-none',
                !dragging && 'transition-transform duration-75',
                view.scale > MIN_ZOOM ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in',
              )}
            />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </Dialog>
  )
}

// Zoom limitado a 100%-500%; ao voltar a 100% a imagem recentraliza.
function zoomTo(view: View, next: number): View {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
  return scale === MIN_ZOOM ? initialView : { ...view, scale }
}
