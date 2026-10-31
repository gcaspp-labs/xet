import { CircleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Aviso enquanto a conexão de tempo real está caída: a tela pode estar
// desatualizada até a reconexão, que é automática.
export function RealtimeNote() {
  return (
    <div className="mx-auto w-full max-w-(--content-max) px-4 pt-4 md:px-[30px]">
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
