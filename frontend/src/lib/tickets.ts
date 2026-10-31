import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Role } from '@/lib/auth'

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'unsupported'

export type TicketSummary = {
  id: number
  protocol: string
  status: 'queued' | 'in_progress' | 'closed'
  arrivedAt: string
  assignedAt: string | null
  contact: { id: number; name: string; phone: string | null; registered: boolean }
  organizationName: string | null
  assignee: { id: number; name: string } | null
  lastMessage: {
    type: MessageType
    body: string | null
    origin: 'customer' | 'agent' | 'phone'
    sentAt: string
  } | null
}

export type Workload = { id: number; name: string; role: Role; activeTickets: number }

export const ticketsKey = (sectorId: number) => ['sectors', sectorId, 'tickets']
export const workloadKey = (sectorId: number) => ['sectors', sectorId, 'workload']

// Chamados abertos do setor (fila e em atendimento), atualizados pelo WebSocket.
export function useTickets(sectorId: number | undefined) {
  return useQuery({
    queryKey: ticketsKey(sectorId ?? 0),
    queryFn: () => api<TicketSummary[]>(`/sectors/${sectorId}/tickets`),
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

// Assumir chamado da fila; o backend decide entre cliques simultâneos.
export function useAssignTicket(sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ticketId: number) => api<void>(`/tickets/${ticketId}/assign`, { method: 'POST' }),
    // Em sucesso ou conflito, a lista passa a mostrar o responsável atual.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketsKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: workloadKey(sectorId) }),
      ]),
  })
}

const mediaLabels: Record<Exclude<MessageType, 'text'>, string> = {
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  document: 'Documento',
  unsupported: 'Tipo de mensagem não suportado',
}

// Prévia da última mensagem do chamado, como na lista de conversas do WhatsApp.
export function lastMessagePreview(ticket: TicketSummary) {
  const message = ticket.lastMessage
  if (!message) {
    return 'Sem mensagens'
  }
  const content =
    message.type === 'text'
      ? (message.body ?? '')
      : message.body
        ? `${mediaLabels[message.type]}: ${message.body}`
        : mediaLabels[message.type]
  return message.origin === 'phone' ? `Pelo celular: ${content}` : content
}
