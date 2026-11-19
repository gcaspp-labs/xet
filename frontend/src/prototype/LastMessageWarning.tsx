// PROTÓTIPO #114: descartável, não vai para a main.
// "Uma versão (ajuste): aviso no topo das janelas Encerrar, Transferir para atendente e Transferir
// para outro setor quando a última mensagem enviada ao cliente está em Falhou ou Enviando;
// trocável por ?ultima=falhou|enviando|entregue e ?janela=encerrar|atendente|setor em /chamados/300."
import { TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useMessages } from '@/lib/conversation'

const texts = {
  failed:
    'A última mensagem ao cliente falhou. Cancele e use Reenviar na conversa para ele não ficar sem resposta.',
  pending:
    'A última mensagem ao cliente ainda está sendo enviada. Aguarde a entrega para ele não ficar sem resposta.',
} as const

// Olha só a última mensagem enviada pelo setor; não impede concluir.
export function LastMessageWarning({ ticketId }: { ticketId: number }) {
  const { data: messages = [] } = useMessages(ticketId)
  const last = [...messages].reverse().find((message) => message.direction === 'outbound')
  if (last?.status !== 'failed' && last?.status !== 'pending') return null
  return (
    <Alert variant="warning">
      <TriangleAlert strokeWidth={1.7} aria-hidden />
      <AlertDescription>{texts[last.status]}</AlertDescription>
    </Alert>
  )
}
