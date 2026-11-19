import { TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useMessages } from '@/lib/conversation'

export function LastMessageWarning({ ticketId }: { ticketId: number }) {
  const { data: messages = [] } = useMessages(ticketId)
  const last = [...messages].reverse().find((message) => message.direction === 'outbound')
  if (last?.status !== 'failed' && last?.status !== 'pending') return null

  const text =
    last.status === 'failed'
      ? 'A última mensagem ao cliente falhou. Cancele e use Reenviar na conversa para ele não ficar sem resposta.'
      : 'A última mensagem ao cliente ainda está sendo enviada. Aguarde a entrega para ele não ficar sem resposta.'

  return (
    <Alert variant="warning">
      <TriangleAlert strokeWidth={1.7} aria-hidden />
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  )
}
