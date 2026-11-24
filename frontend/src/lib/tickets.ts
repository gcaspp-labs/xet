import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { noteTicketRead } from '@/lib/alerts'
import { api } from '@/lib/api'
import type { Role } from '@/lib/auth'

// 'contact' é o cartão de contato, mostrado como cartão na conversa (spec #312).
export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'contact'
  | 'unsupported'
  | 'media_unavailable'

export type TicketSummary = {
  id: number
  protocol: string
  status: 'queued' | 'in_progress' | 'pending' | 'closed'
  arrivedAt: string
  assignedAt: string | null
  contact: { id: number; name: string; phone: string | null; registered: boolean }
  organizationName: string | null
  municipalityName: string | null
  assignee: { id: number; name: string } | null
  // Mensagens recebidas do cliente depois da última leitura do responsável; 0 na fila e no pendente.
  unreadCount: number
  lastMessage: {
    type: MessageType
    body: string | null
    origin: 'customer' | 'agent' | 'phone'
    sentAt: string
    // Mensagem excluída só no XET ("para mim"): a lista mostra um aviso, e o conteúdo não vem.
    hidden?: boolean
    // Nome do primeiro cartão da mensagem de contato; nulo nos outros tipos.
    contactName?: string | null
  } | null
}

// Endereço do chamado pela situação: ativo abre em Chamados; encerrado, em Atendimentos.
export const ticketPath = (ticket: {
  id: number
  status: 'queued' | 'in_progress' | 'pending' | 'closed'
}) => (ticket.status === 'closed' ? `/atendimentos/${ticket.id}` : `/chamados/${ticket.id}`)

// Chamado pendente do setor: o motivo, quem marcou e desde quando, para a aba Pendentes
// (queue.md, regras da spec #332). A lista vem do servidor, mais antigos primeiro.
export type PendingTicket = {
  id: number
  protocol: string
  contact: { id: number; name: string; phone: string | null; registered: boolean }
  organizationName: string | null
  municipalityName: string | null
  reason: string | null
  pendingBy: { id: number; name: string } | null
  pendingAt: string | null
  sector: { id: number; name: string }
}

export function pendingTicketsQuery(sectorId: number) {
  return {
    queryKey: pendingTicketsKey(sectorId),
    queryFn: () => api<PendingTicket[]>(`/sectors/${sectorId}/pending-tickets`),
  }
}

// Chamados pendentes do setor, atualizados pelo WebSocket.
export function usePendingTickets(sectorId: number | undefined) {
  return useQuery({
    ...pendingTicketsQuery(sectorId ?? 0),
    enabled: sectorId !== undefined,
  })
}

// Número do chamado no endereço; `null` quando não é um id válido (ex.: /chamados/abc).
export function parseTicketId(param: string | undefined) {
  return param !== undefined && /^[1-9]\d{0,14}$/.test(param) ? Number(param) : null
}

export type Workload = {
  id: number
  name: string
  role: Role
  active: boolean
  activeTickets: number
}

export const ticketsKey = (sectorId: number) => ['sectors', sectorId, 'tickets']
export const pendingTicketsKey = (sectorId: number) => ['sectors', sectorId, 'pending-tickets']
export const workloadKey = (sectorId: number) => ['sectors', sectorId, 'workload']

export const ticketsQuery = (sectorId: number) => ({
  queryKey: ticketsKey(sectorId),
  queryFn: () => api<TicketSummary[]>(`/sectors/${sectorId}/tickets`),
})

// Marca como lido o chamado aberto pelo responsável (spec #310). Para os demais, o servidor
// responde sucesso sem mudar nada, então a tela chama sem conferir quem é o responsável.
export function useMarkTicketRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticketId: number) => api<void>(`/tickets/${ticketId}/read`, { method: 'POST' }),
    onSuccess: (_data, ticketId) => {
      // A leitura muda a chave da reserva das mensagens: a mensagem que chega em seguida alerta
      // mesmo dentro dos 10 s do alerta anterior (spec #310).
      noteTicketRead(ticketId)
      return queryClient.invalidateQueries({ queryKey: ['sectors'] })
    },
  })
}

// Chamados abertos do setor (fila e em atendimento), atualizados pelo WebSocket.
export function useTickets(sectorId: number | undefined) {
  return useQuery({
    ...ticketsQuery(sectorId ?? 0),
    enabled: sectorId !== undefined,
  })
}

// Chamados em atendimento por pessoa do setor; informativo, sem limite.
export function useWorkload(sectorId: number | undefined) {
  return useQuery({
    queryKey: workloadKey(sectorId ?? 0),
    queryFn: () => api<Workload[]>(`/sectors/${sectorId}/workload`),
    enabled: sectorId !== undefined,
  })
}

const mediaLabels: Record<Exclude<MessageType, 'text'>, string> = {
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  document: 'Documento',
  contact: 'Contato',
  unsupported: 'Tipo de mensagem não suportado',
  media_unavailable: 'Arquivo não pôde ser baixado',
}

// Prévia da última mensagem do chamado, como na lista de conversas do WhatsApp.
export function lastMessagePreview(ticket: TicketSummary) {
  const message = ticket.lastMessage
  if (!message) {
    return 'Sem mensagens'
  }
  if (message.hidden) {
    return 'Mensagem excluída no XET'
  }
  const body =
    message.origin === 'agent'
      ? message.body?.replace(/^\*([^*\n]+:)\*(?:\n|$)/, '$1 ')
      : message.body
  const content =
    message.type === 'contact'
      ? // Cartão de contato: o nome do primeiro cartão, como no WhatsApp.
        `👤 ${message.contactName ?? 'Contato'}`
      : message.type === 'text'
        ? (body ?? '')
        : body
          ? `${mediaLabels[message.type]}: ${body}`
          : mediaLabels[message.type]
  return message.origin === 'phone' ? `Pelo celular: ${content}` : content
}

type StartedConversation = {
  ticketId: number
  // Verdadeiro quando o contato já tinha chamado aberto no setor: nada foi enviado.
  existing: boolean
}

// Chamado aberto do contato no setor, conferido ao escolher o contato.
export function openTicketOf(sectorId: number, contactId: number) {
  return api<{ ticketId: number | null }>(`/sectors/${sectorId}/contacts/${contactId}/open-ticket`)
}

// Inicia a conversa pelo número do setor: a primeira mensagem cria o chamado
// atribuído ao usuário. O mesmo requestId numa nova tentativa não duplica.
export function useStartConversation(sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { contactId: number; requestId: string; body: string }) =>
      api<StartedConversation>(`/sectors/${sectorId}/conversations`, {
        method: 'POST',
        body: { contactId: input.contactId, clientRequestId: input.requestId, body: input.body },
      }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketsKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: workloadKey(sectorId) }),
      ]),
  })
}
