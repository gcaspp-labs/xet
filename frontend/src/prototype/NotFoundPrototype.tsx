// PROTÓTIPO #188: descartável, não vai para a main.
// Plano: uma versão (ajuste de um padrão existente) da tela Não encontrado, com o padrão de erro
// da TicketPage (Topbar + Alert warning) e um botão Voltar. Rotas de teste:
//   /atendimentos/300  chamado ativo           -> Não encontrado
//   /atendimentos/999  chamado inexistente 404 -> Não encontrado
//   /atendimentos/777  sem acesso 403          -> erro de hoje (sem mudança)
//   /atendimentos/500  chamado encerrado       -> tela do chamado de hoje
//   /conversas, /conversas/:id, /atendimento   -> Não encontrado
//   /chamados/999 (404) ou /chamados/abc       -> Não encontrado (item Chamados ativo)
//   /qualquer-coisa (rota coringa, logado)     -> Não encontrado (nenhum item ativo)
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { Topbar } from '@/components/Topbar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { useTicket } from '@/lib/conversation'
import ConversasPage from '@/pages/ConversasPage'
import TicketPage from '@/pages/ticket/TicketPage'

export function NotFoundPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Endereço aberto direto (sem página anterior no app): Voltar vai ao início.
  const goBack = () => (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1))
  return (
    <>
      <Topbar title="Não encontrado" />
      <div className="mx-auto flex w-full max-w-(--content-max) flex-col items-start gap-4 px-4 py-4 md:px-[30px] md:py-[30px]">
        <Alert variant="warning">
          <CircleAlert strokeWidth={1.7} aria-hidden />
          <AlertDescription>
            Esta página não existe ou não está disponível neste endereço. Volte ou escolha uma opção
            no menu.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={goBack}>
          <ArrowLeft strokeWidth={1.7} aria-hidden />
          Voltar
        </Button>
      </div>
    </>
  )
}

// /atendimentos/:id: encerrado abre a tela de hoje; ativo ou 404 mostra Não encontrado; 403 segue o erro de hoje.
export function AtendimentoDetailPrototype() {
  const ticketId = Number(useParams().ticketId)
  const { data: ticket, error } = useTicket(ticketId)
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />
  if (ticket && ticket.status !== 'closed') return <NotFoundPage />
  // Encerrado, carregando ou outro erro (403): a tela do chamado de hoje, sem mudança.
  return <TicketPage />
}

// /chamados/:id: id inválido ou 404 mostra Não encontrado; o resto (ativo, 403, erro de rede) segue a tela de hoje.
export function ChamadoDetailPrototype() {
  const param = useParams().ticketId ?? ''
  const valid = /^\d+$/.test(param)
  const { error } = useTicket(valid ? Number(param) : 0, valid)
  if (!valid) return <NotFoundPage />
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />
  return <ConversasPage />
}
