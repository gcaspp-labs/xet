import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FormSubject } from '@/lib/closing'
import { closedTodayKey, type MessageType, ticketsKey, workloadKey } from '@/lib/tickets'

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
  startedAt: string
  endedAt: string | null
  closedAt: string | null
  subject: string | null
  resolution: string | null
  contact: { id: number; name: string; phone: string | null; registered: boolean }
  organization: { id: number; name: string; municipality: { id: number; name: string } } | null
  assignee: { id: number; name: string } | null
  closedBy: { id: number; name: string } | null
  closureType: 'resolved' | 'transferred' | 'cancelled' | null
  // Chamado do setor de origem, quando este veio de uma transferência entre setores.
  previous: {
    id: number
    protocol: string
    sectorName: string
    subject: string | null
    resolution: string | null
    closedByName: string | null
  } | null
  // Setor e protocolo para onde este chamado foi transferido, sem acesso a ele.
  next: { protocol: string; sectorName: string } | null
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
  media: {
    id: number
    mimeType: string
    fileName: string | null
    sizeBytes: number
    durationSeconds: number | null
  } | null
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
  closureType: 'resolved' | 'transferred' | 'cancelled' | null
  sectorName: string
  arrivedAt: string
  closedAt: string | null
  subject: string | null
  contactName: string
  organizationName: string | null
  municipalityName: string | null
  assigneeName: string | null
}

// Como o chamado ganhou o primeiro responsável (conversa iniciada ou assumido),
// cada transferência, a devolução à fila, o encerramento, o cancelamento com o motivo e as correções,
// com quem fez e de quem para quem.
export type AssignmentLog = {
  id: number
  action:
    | 'ticket_started'
    | 'ticket_assigned'
    | 'ticket_transferred_user'
    | 'ticket_returned'
    | 'ticket_closed'
    | 'ticket_transferred_sector'
    | 'ticket_cancelled'
    | 'ticket_corrected'
  createdAt: string
  actor: { id: number; name: string } | null
  fromName: string | null
  toName: string | null
  toSectorName: string | null
  reason: string | null
}

export const ticketKey = (ticketId: number) => ['tickets', ticketId]
const messagesKey = (ticketId: number) => ['tickets', ticketId, 'messages']
const assignmentsKey = (ticketId: number) => ['tickets', ticketId, 'assignments']
const notesKey = (ticketId: number) => ['tickets', ticketId, 'notes']
const closingFormKey = (ticketId: number) => ['tickets', ticketId, 'closing-form']
const modulesKey = (ticketId: number) => ['tickets', ticketId, 'modules']
const correctionsKey = (ticketId: number) => ['tickets', ticketId, 'corrections']
const transferSectorsKey = (ticketId: number) => ['tickets', ticketId, 'transfer-sectors']
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

export function useAssignments(ticketId: number) {
  return useQuery({
    queryKey: assignmentsKey(ticketId),
    queryFn: () => api<AssignmentLog[]>(`/tickets/${ticketId}/assignments`),
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
        queryClient.invalidateQueries({ queryKey: assignmentsKey(ticketId) }),
        sectorId !== undefined && queryClient.invalidateQueries({ queryKey: ticketsKey(sectorId) }),
        sectorId !== undefined &&
          queryClient.invalidateQueries({ queryKey: workloadKey(sectorId) }),
      ]),
  })
}

// Assumir chamado sem estar na conversa dele, pelo painel, pela lista ou pelo sino; o
// backend decide entre cliques simultâneos. O setor vem na chamada porque o sino reúne
// vários setores para o administrador.
export function useAssignTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId }: { ticketId: number; sectorId: number }) =>
      api<void>(`/tickets/${ticketId}/assign`, { method: 'POST' }),
    // Em sucesso ou conflito, a lista e a conversa aberta mostram o responsável atual.
    onSettled: (_data, _error, { ticketId, sectorId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketsKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: workloadKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: ticketKey(ticketId), exact: true }),
        queryClient.invalidateQueries({ queryKey: assignmentsKey(ticketId) }),
      ]),
  })
}

// Transfere o chamado em atendimento para outra pessoa do setor; o backend
// confere quem pode transferir e o destino.
export function useTransferTicket(ticketId: number, sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assigneeId: number) =>
      api<void>(`/tickets/${ticketId}/transfer`, { method: 'POST', body: { assigneeId } }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketKey(ticketId), exact: true }),
        queryClient.invalidateQueries({ queryKey: assignmentsKey(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ticketsKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: workloadKey(sectorId) }),
      ]),
  })
}

// Devolve à fila o chamado em atendimento; o backend confere quem pode devolver.
export function useReturnTicket(ticketId: number, sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>(`/tickets/${ticketId}/return`, { method: 'POST' }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketKey(ticketId), exact: true }),
        queryClient.invalidateQueries({ queryKey: assignmentsKey(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ticketsKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: workloadKey(sectorId) }),
      ]),
  })
}

// Ponto de partida do formulário de encerramento: módulos ativos e assuntos
// do setor, órgão sugerido (do chamado ou do contato) e início automático.
export type ClosingForm = {
  modules: { id: number; name: string }[]
  // Assuntos da lista do setor do chamado, sugeridos no campo Assunto, cada um
  // com as soluções sugeridas para a Resolução.
  subjects: FormSubject[]
  // Módulos do contato entre os ativos do setor: já vêm marcados.
  contactModuleIds: number[]
  organization: { id: number; name: string; municipality: { id: number; name: string } } | null
  startedAt: string
}

// Horários omitidos ficam automáticos: início na chegada, fim ao salvar.
export type ClosingInput = {
  subject: string
  resolution: string
  moduleIds: number[]
  organizationId: number
  startedAt?: string
  endedAt?: string
  // Respostas "adicionar" às perguntas ao salvar: o assunto entra na lista do
  // setor, e a resolução, na lista do assunto.
  addSubject?: boolean
  addSolution?: boolean
}

export function useClosingForm(ticketId: number, enabled: boolean) {
  return useQuery({
    queryKey: closingFormKey(ticketId),
    queryFn: () => api<ClosingForm>(`/tickets/${ticketId}/closing-form`),
    enabled,
  })
}

// Módulos registrados no encerramento.
export function useTicketModules(ticketId: number, enabled: boolean) {
  return useQuery({
    queryKey: modulesKey(ticketId),
    queryFn: () => api<{ id: number; name: string }[]>(`/tickets/${ticketId}/modules`),
    enabled,
  })
}

// Salva o formulário e encerra o chamado; o backend confere o responsável,
// o cadastro do contato, os módulos e os horários.
export function useCloseTicket(ticketId: number, sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ClosingInput) =>
      api<void>(`/tickets/${ticketId}/close`, { method: 'POST', body }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketKey(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ticketsKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: workloadKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: closedTodayKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: historyKey }),
      ]),
  })
}

// Cancela o chamado aberto; o backend confere quem pode cancelar e o motivo.
export function useCancelTicket(ticketId: number, sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) =>
      api<void>(`/tickets/${ticketId}/cancel`, { method: 'POST', body: { reason } }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketKey(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ticketsKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: workloadKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: closedTodayKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: historyKey }),
      ]),
  })
}

// Dados completos do atendimento encerrado depois da correção, com o motivo.
export type CorrectionInput = {
  subject: string
  resolution: string
  moduleIds: number[]
  organizationId: number
  startedAt: string
  endedAt: string
  spokeWith: string
  reason: string
  addSubject?: boolean
  addSolution?: boolean
}

// Campo corrigido com o valor anterior e o novo: órgão pelo nome, módulos
// pela lista de nomes e horários em ISO 8601.
export type CorrectionChange = {
  field:
    'subject' | 'resolution' | 'organization' | 'modules' | 'started_at' | 'ended_at' | 'spoke_with'
  from: string | string[] | null
  to: string | string[] | null
}

export type Correction = {
  id: number
  createdAt: string
  actor: { id: number; name: string } | null
  reason: string
  changes: CorrectionChange[]
}

// Histórico de alterações do atendimento encerrado, da mais antiga à mais recente.
export function useCorrections(ticketId: number, enabled: boolean) {
  return useQuery({
    queryKey: correctionsKey(ticketId),
    queryFn: () => api<Correction[]>(`/tickets/${ticketId}/corrections`),
    enabled,
  })
}

// Corrige o atendimento encerrado; o backend confere quem pode corrigir, o
// motivo e as mesmas regras do encerramento.
export function useCorrectTicket(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CorrectionInput) =>
      api<void>(`/tickets/${ticketId}/correct`, { method: 'POST', body }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketKey(ticketId) }),
        queryClient.invalidateQueries({ queryKey: historyKey }),
      ]),
  })
}

// Setores para onde o chamado pode ser transferido: os outros setores ativos.
export function useTransferSectors(ticketId: number, enabled: boolean) {
  return useQuery({
    queryKey: transferSectorsKey(ticketId),
    queryFn: () => api<{ id: number; name: string }[]>(`/tickets/${ticketId}/transfer-sectors`),
    enabled,
  })
}

// Salva o formulário, encerra a etapa como transferida e abre o chamado
// vinculado na fila do destino; o backend confere tudo como no encerramento.
export function useTransferSector(ticketId: number, sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ClosingInput & { sectorId: number }) =>
      api<{ id: number; protocol: string }>(`/tickets/${ticketId}/transfer-sector`, {
        method: 'POST',
        body,
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketKey(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ticketsKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: workloadKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: closedTodayKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: historyKey }),
      ]),
  })
}
