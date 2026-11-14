import { CircleAlert } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Aviso enquanto a conexão de tempo real está caída: a tela pode estar
// desatualizada até a reconexão, que é automática.
//
// Enquanto aparece, publica a própria altura em --realtime-note-height, para as telas que ocupam
// a altura da janela (Chamados) descontarem o aviso e a página não ganhar rolagem.
export function RealtimeNote() {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const root = document.documentElement
    const publish = () =>
      root.style.setProperty(
        '--realtime-note-height',
        `${element.getBoundingClientRect().height}px`,
      )
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--realtime-note-height')
    }
  }, [])

  return (
    <div ref={ref} className="mx-auto w-full max-w-(--content-max) px-4 pt-4 md:px-[30px]">
      <Alert variant="warning">
        <CircleAlert strokeWidth={1.7} aria-hidden />
        <AlertDescription>
          Atualização em tempo real interrompida. Reconectando; se o aviso continuar, recarregue a
          página.
        </AlertDescription>
      </Alert>
    </div>
  )
}
