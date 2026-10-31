import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { type MessageType, ticketsKey, workloadKey } from '@/lib/tickets'

// Limite de arquivo do backend (spec.md, Conversa).
export const maxFileSize = 16 * 1024 * 1024

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export type TicketDetail = {
  id: number
  protocol: string
  status: 'queued' | 'in_progress' | 'closed'
  sector: { id: number; name: string }
  spokeWith: string | null
  arrivedAt: string
  assignedAt: string | null
  closedAt: string | null
  subject: string | null
  resolution: string | null
  contact: { id: number; name: string; phone: string | null; registered: boolean }
  organization: { id: number; name: string } | null
  assignee: { id: number; name: string } | null
}

export type Message = {
  id: number
  ticketId: number
  direction: 'inbound' | 'outbound'
  origin: 'customer' | 'agent' | 'phone'
  type: MessageType
  body: string | null
  status: MessageStatus | null
  failureReason: string | null
  sentAt: string
  author: { id: number; name: string } | null
  media: { id: number; mimeType: string; fileName: string | null; sizeBytes: number } | null
}

export type Note = {
  id: number
  body: string
  createdAt: string
  author: { id: number; name: string }
}

export type HistoryEntry = {
  id: number
  protocol: string
  status: 'queued' | 'in_progress' | 'closed'
  sectorName: string
  arrivedAt: string
  closedAt: string | null
  subject: string | null
  contactName: string
  organizationName: string | null
  assigneeName: string | null
}

export const ticketKey = (ticketId: number) => ['tickets', ticketId]
const messagesKey = (ticketId: number) => ['tickets', ticketId, 'messages']
const notesKey = (ticketId: number) => ['tickets', ticketId, 'notes']
export const historyKey = ['history']

// Identificador de envio (UUID v4). crypto.randomUUID só existe em HTTPS ou
// localhost; o teste pelo celular via Tailscale usa HTTP.
export function newRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function useTicket(ticketId: number) {
  return useQuery({
    queryKey: ticketKey(ticketId),
    queryFn: () => api<TicketDetail>(`/tickets/${ticketId}`),
  })
}

export function useMessages(ticketId: number) {
  return useQuery({
    queryKey: messagesKey(ticketId),
    queryFn: () => api<Message[]>(`/tickets/${ticketId}/messages`),
  })
}

export function useNotes(ticketId: number) {
  return useQuery({
    queryKey: notesKey(ticketId),
    queryFn: () => api<Note[]>(`/tickets/${ticketId}/notes`),
  })
}

export function useContactHistory(contactId: number | undefined) {
  return useQuery({
    queryKey: [...historyKey, 'contact', contactId],
    queryFn: () => api<HistoryEntry[]>(`/contacts/${contactId}/tickets`),
    enabled: contactId !== undefined,
  })
}

export function useOrganizationHistory(organizationId: number | undefined) {
  return useQuery({
    queryKey: [...historyKey, 'organization', organizationId],
    queryFn: () => api<HistoryEntry[]>(`/organizations/${organizationId}/tickets`),
    enabled: organizationId !== undefined,
  })
}

type SentMessage = { id: number; status: MessageStatus; failureReason: string | null }

export type Outgoing = { requestId: string; body: string; file: File | null; voice?: Blob }

// Extensão do arquivo gravado, só para o nome no envio; o backend lê o conteúdo.
function recordingName(blob: Blob) {
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  return `gravacao.${ext}`
}

// Envia texto, arquivo ou áudio gravado (como mensagem de voz, sem legenda).
// O mesmo requestId numa nova tentativa devolve a mensagem já registrada, sem
// enviar de novo; o backend confere o responsável.
export function useSendMessage(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, body, file, voice }: Outgoing) => {
      if (voice) {
        const form = new FormData()
        form.append('clientRequestId', requestId)
        form.append('voice', voice, recordingName(voice))
        return api<SentMessage>(`/tickets/${ticketId}/messages`, { method: 'POST', body: form })
      }
      if (!file) {
        return api<SentMessage>(`/tickets/${ticketId}/messages`, {
          method: 'POST',
          body: { clientRequestId: requestId, body },
        })
      }
      const form = new FormData()
      form.append('clientRequestId', requestId)
      form.append('caption', body)
      form.append('file', file)
      return api<SentMessage>(`/tickets/${ticketId}/messages`, { method: 'POST', body: form })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: messagesKey(ticketId) }),
  })
}

export function useRetryMessage(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (messageId: number) =>
      api<SentMessage>(`/messages/${messageId}/retry`, { method: 'POST' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: messagesKey(ticketId) }),
  })
}

export function useSaveSpokeWith(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (spokeWith: string) =>
      api<void>(`/tickets/${ticketId}/spoke-with`, { method: 'PUT', body: { spokeWith } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKey(ticketId), exact: true }),
  })
}

export function useAddNote(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) =>
      api<Note>(`/tickets/${ticketId}/notes`, { method: 'POST', body: { body } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKey(ticketId) }),
  })
}

// Assumir pela tela da conversa: atualiza o chamado e as listas do painel.
export function useAssignFromTicket(ticketId: number, sectorId: number | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>(`/tickets/${ticketId}/assign`, { method: 'POST' }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketKey(ticketId), exact: true }),
        sectorId !== undefined && queryClient.invalidateQueries({ queryKey: ticketsKey(sectorId) }),
        sectorId !== undefined &&
          queryClient.invalidateQueries({ queryKey: workloadKey(sectorId) }),
      ]),
  })
}
