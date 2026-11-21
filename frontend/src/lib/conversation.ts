import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import type { FormSubject } from '@/lib/closing'
import { pageParams, type Page, type PageRequest } from '@/lib/paging'
import type { User } from '@/lib/auth'
import { closedTicketsKey, type TicketChannel } from '@/lib/closed-tickets'
import { type MessageType, ticketsKey, workloadKey } from '@/lib/tickets'

// Limite de arquivo do backend (spec.md, Conversa).
export const maxFileSize = 16 * 1024 * 1024

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export type TicketDetail = {
  id: number
  protocol: string
  status: 'queued' | 'in_progress' | 'closed'
  // Como o atendimento aconteceu: WhatsApp ou registro por telefone.
  channel: TicketChannel
  sector: { id: number; name: string }
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
    // Motivo escrito na transferência, quando houver.
    reason: string | null
  } | null
  // Setor e protocolo para onde este chamado foi transferido, com o motivo escrito, sem acesso a ele.
  next: { protocol: string; sectorName: string; reason: string | null } | null
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
  reactions: MessageReactions
  quote: MessageQuote | null
  // Horário da versão atual, quando a mensagem foi editada (no XET, pelo cliente ou pelo celular).
  editedAt: string | null
  // Exclusão da mensagem, com o conteúdo guardado: `scope` diz se foi para todos ou só no XET
  // ("para mim"), e `origin` quem excluiu: 'agent' é o XET.
  deletion: {
    at: string
    scope: 'everyone' | 'local'
    origin: 'customer' | 'agent' | 'phone'
  } | null
}

// A mensagem que uma resposta cita; `quote` é null quando não há citação. `messageId` liga à
// mensagem citada só quando ela está no mesmo chamado. `type` e `text` são o trecho que o WhatsApp
// entregou, e podem faltar: com a ligação a tela mostra a mensagem ligada, e sem os dois, "Mensagem
// indisponível".
export type MessageQuote = {
  messageId: number | null
  type: MessageType | null
  text: string | null
}

// Reação atual de cada lado da mensagem; um lado sem reação é null. O setor tem uma só: `by` é quem
// reagiu por último, e `viaPhone` diz que veio do celular do setor. Os dois vêm vazios quando o
// provedor não diz, e nada pode depender deles.
export type MessageReactions = {
  customer: { emoji: string; at: string } | null
  sector: {
    emoji: string
    at: string
    by: { id: number; name: string } | null
    viaPhone: boolean
  } | null
}

export type HistoryEntry = {
  id: number
  protocol: string
  status: 'queued' | 'in_progress' | 'closed'
  channel: TicketChannel
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
  // Setor de origem da transferência que abriu este chamado; vem só no aviso do destino.
  fromSectorName: string | null
  // Motivo do cancelamento, da correção ou da transferência entre setores.
  reason: string | null
}

export const ticketKey = (ticketId: number) => ['tickets', ticketId]
const messagesKey = (ticketId: number) => ['tickets', ticketId, 'messages']
const assignmentsKey = (ticketId: number) => ['tickets', ticketId, 'assignments']
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

export function useTicket(ticketId: number, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ticketKey(ticketId),
    queryFn: () => api<TicketDetail>(`/tickets/${ticketId}`),
    // 404 e 403 são respostas definitivas: repetir só deixa a tela em branco por vários segundos.
    // Erro de rede ou do servidor segue com as tentativas padrão (3).
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.status === 404 || error.status === 403)) &&
      failureCount < 3,
  })
}

export function useMessages(ticketId: number) {
  return useQuery({
    queryKey: messagesKey(ticketId),
    queryFn: () => api<Message[]>(`/tickets/${ticketId}/messages`),
  })
}

// Uma versão da mensagem (a original ou uma edição, com o conteúdo) ou a exclusão dela (com o
// alcance), na ordem em que aconteceram. Só existe o que o provedor entregou: uma mensagem nunca
// alterada vem sem nenhuma.
export type MessageChange = {
  id: number
  kind: 'original' | 'edit' | 'deletion'
  origin: 'customer' | 'agent' | 'phone'
  author: { id: number; name: string } | null
  body: string | null
  scope: 'everyone' | 'local' | null
  at: string
}

export function useMessageChanges(ticketId: number, messageId: number) {
  return useQuery({
    // Sob a chave das mensagens do chamado: o aviso de alteração em tempo real também a recarrega.
    queryKey: [...messagesKey(ticketId), messageId, 'changes'],
    queryFn: () => api<MessageChange[]>(`/messages/${messageId}/changes`),
  })
}

export function useAssignments(ticketId: number) {
  return useQuery({
    queryKey: assignmentsKey(ticketId),
    queryFn: () => api<AssignmentLog[]>(`/tickets/${ticketId}/assignments`),
  })
}

export type HistorySort = 'protocol' | 'arrived' | 'contact' | 'sector' | 'assignee' | 'status'
export const defaultHistoryRequest: PageRequest<HistorySort> = {
  page: 1,
  sort: 'arrived',
  direction: 'desc',
}

export function useContactHistory(contactId: number | undefined, request = defaultHistoryRequest) {
  return useQuery({
    queryKey: [...historyKey, 'contact', contactId, request],
    queryFn: () =>
      api<Page<HistoryEntry>>(
        `/contacts/${contactId}/tickets?${new URLSearchParams(pageParams(request))}`,
      ),
    enabled: contactId !== undefined,
  })
}

export function useOrganizationHistory(
  organizationId: number | undefined,
  request = defaultHistoryRequest,
) {
  return useQuery({
    queryKey: [...historyKey, 'organization', organizationId, request],
    queryFn: () =>
      api<Page<HistoryEntry>>(
        `/organizations/${organizationId}/tickets?${new URLSearchParams(pageParams(request))}`,
      ),
    enabled: organizationId !== undefined,
  })
}

type SentMessage = { id: number; status: MessageStatus; failureReason: string | null }

export type Outgoing = {
  requestId: string
  body: string
  file: File | null
  voice?: Blob
  // A mensagem do chamado que a resposta cita.
  quotedMessageId?: number
}

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
    mutationFn: ({ requestId, body, file, voice, quotedMessageId }: Outgoing) => {
      if (voice) {
        const form = new FormData()
        form.append('clientRequestId', requestId)
        if (quotedMessageId !== undefined) form.append('quotedMessageId', String(quotedMessageId))
        form.append('voice', voice, recordingName(voice))
        return api<SentMessage>(`/tickets/${ticketId}/messages`, { method: 'POST', body: form })
      }
      if (!file) {
        return api<SentMessage>(`/tickets/${ticketId}/messages`, {
          method: 'POST',
          body: { clientRequestId: requestId, body, quotedMessageId },
        })
      }
      const form = new FormData()
      form.append('clientRequestId', requestId)
      if (quotedMessageId !== undefined) form.append('quotedMessageId', String(quotedMessageId))
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

// Só mensagem que o WhatsApp conhece recebe reação: a recebida, ou a enviada já com identificador
// (enviada, entregue ou lida). Mensagem enviando ou com falha, nota e aviso do sistema não.
export function canReactTo(message: Message) {
  return (
    message.direction === 'inbound' ||
    (message.status !== null && ['sent', 'delivered', 'read'].includes(message.status))
  )
}

// Só a mensagem que o WhatsApp conhece é citada, como na reação, e a exibida como não suportada
// (figurinha, localização, aviso antigo de reação) fica de fora. Só o responsável cita; o backend
// confere de novo.
export function canQuoteMessage(message: Message) {
  return canReactTo(message) && message.type !== 'unsupported'
}

// Conteúdo ocultado pelo XET (excluída para todos ou para mim): em Chamados vira um aviso. A exclusão
// feita pelo cliente ou pelo celular do setor mantém o conteúdo conhecido, com a etiqueta "Excluída".
export function isHiddenByXet(message: Message) {
  return message.deletion?.origin === 'agent'
}

// O id do botão que abre as versões e a exclusão em Atendimentos: o foco volta para ele ao fechar.
export const messageChangesId = (messageId: number) => `message-changes-${messageId}`

// Em Atendimentos, o botão da mensagem alterada: diz o que há para ver, sem oferecer ação alguma.
export function changesLabel(message: Message) {
  return message.editedAt && message.deletion
    ? 'Ver versões e exclusão'
    : message.deletion
      ? 'Ver exclusão'
      : 'Ver versões'
}

// Prazos do WhatsApp para editar (15 minutos) e excluir para todos (dois dias) uma mensagem enviada.
// A tela só os usa para oferecer ou explicar a ação; quem decide é o backend, com o relógio dele.
const editWindowMs = 15 * 60 * 1000
const revokeWindowMs = 48 * 60 * 60 * 1000

const editableTypes: MessageType[] = ['text', 'image', 'video', 'document']

export type MessageChanges = {
  edit: boolean
  deleteForEveryone: boolean
  deleteForMe: boolean
  // Por que falta uma ação, quando há ação possível de entender.
  note: string | null
}

// O que o responsável pode fazer agora com a mensagem enviada pelo XET. `null` quando a mensagem não
// admite nenhuma ação nem explicação: a do cliente, a do celular do setor e a já excluída.
export function messageChanges(message: Message, now = Date.now()): MessageChanges | null {
  if (message.direction !== 'outbound' || message.origin !== 'agent' || message.deletion) {
    return null
  }
  if (message.status === null || message.status === 'pending') {
    return {
      edit: false,
      deleteForEveryone: false,
      deleteForMe: false,
      note: 'Mensagem em envio. Edição e exclusão indisponíveis.',
    }
  }
  if (message.status === 'failed') {
    return {
      edit: false,
      deleteForEveryone: false,
      deleteForMe: true,
      note: 'Mensagem com falha só pode ser excluída para mim.',
    }
  }
  const age = now - Date.parse(message.sentAt)
  const editable = editableTypes.includes(message.type)
  const edit = editable && age < editWindowMs
  const deleteForEveryone = age < revokeWindowMs
  let note: string | null = null
  if (!editable) {
    note = 'Áudio não pode ser editado.'
  } else if (!edit) {
    note = deleteForEveryone
      ? 'Prazo de edição encerrado.'
      : 'Prazos de edição e de exclusão para todos encerrados. Ainda é possível excluir para mim.'
  } else if (!deleteForEveryone) {
    note = 'Prazo para excluir para todos encerrado. Ainda é possível excluir para mim.'
  }
  return { edit, deleteForEveryone, deleteForMe: true, note }
}

// Identificador do botão do menu da mensagem, para devolver o foco a ele ao fechar a janela.
export const messageMenuId = (messageId: number) => `message-actions-${messageId}`

// O texto que a edição muda: o conteúdo sem o apelido ("*Ana:*") gravado no envio, que não se edita.
export function editableText(message: Message) {
  const body = message.body ?? ''
  const prefix = body.match(/^\*([^*\n]+:)\*(?:\n|$)/)
  return prefix ? body.slice(prefix[0].length) : body
}

// Edita o texto ou a legenda. O mesmo requestId numa nova tentativa devolve o resultado da primeira;
// depois de uma recusa, é preciso um novo (o backend confere o responsável, o prazo e o estado).
export function useEditMessage(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      messageId,
      requestId,
      body,
    }: {
      messageId: number
      requestId: string
      body: string
    }) =>
      api<{ id: number }>(`/messages/${messageId}/edit`, {
        method: 'POST',
        body: { clientRequestId: requestId, body },
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: messagesKey(ticketId) }),
  })
}

// Exclui para todos (também no WhatsApp) ou para mim (oculta para o setor, só no XET).
export function useDeleteMessage(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      messageId,
      requestId,
      scope,
    }: {
      messageId: number
      requestId: string
      scope: 'everyone' | 'local'
    }) =>
      api<{ id: number }>(`/messages/${messageId}/delete`, {
        method: 'POST',
        body: { clientRequestId: requestId, scope },
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: messagesKey(ticketId) }),
  })
}

// Reagir pelo setor: o mesmo emoji de agora remove, outro troca (quem decide é o backend). A tela
// muda na hora; se o envio falhar, volta a reação anterior daquela mensagem e um aviso explica,
// sem nova tentativa. Ao terminar, recarrega a conversa para mostrar quem reagiu.
export function useReactToMessage(ticketId: number) {
  const queryClient = useQueryClient()
  const key = messagesKey(ticketId)
  const setSector = (messageId: number, sector: MessageReactions['sector']) =>
    queryClient.setQueryData<Message[]>(key, (list) =>
      list?.map((m) => (m.id === messageId ? { ...m, reactions: { ...m.reactions, sector } } : m)),
    )
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: number; emoji: string; actor: User }) =>
      api<{ emoji: string | null }>(`/messages/${messageId}/reaction`, {
        method: 'PUT',
        body: { emoji },
      }),
    onMutate: async ({ messageId, emoji, actor }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before =
        queryClient.getQueryData<Message[]>(key)?.find((m) => m.id === messageId)?.reactions
          .sector ?? null
      setSector(
        messageId,
        before?.emoji === emoji
          ? null
          : {
              emoji,
              at: new Date().toISOString(),
              by: { id: actor.id, name: actor.name },
              viaPhone: false,
            },
      )
      return { before }
    },
    onError: (error, { messageId }, context) => {
      setSector(messageId, context?.before ?? null)
      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível enviar a reação. Tente de novo.',
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
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
  subjectModuleId?: number
  solutionModuleId?: number
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
        queryClient.invalidateQueries({ queryKey: closedTicketsKey }),
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
        queryClient.invalidateQueries({ queryKey: closedTicketsKey }),
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
  reason: string
  addSubject?: boolean
  addSolution?: boolean
  subjectModuleId?: number
  solutionModuleId?: number
}

// Campo corrigido com o valor anterior e o novo: órgão pelo nome, módulos
// pela lista de nomes e horários em ISO 8601. O "spoke_with" só vem em
// correções antigas e a tela o esconde, até a migração que apaga esses dados.
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

// Encerra a etapa como transferida, sem formulário, e abre o chamado vinculado
// na fila do destino; o motivo é opcional. O backend confere tudo de novo.
export function useSectorTransfer(ticketId: number, sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { sectorId: number; reason?: string }) =>
      api<{ id: number; protocol: string }>(`/tickets/${ticketId}/sector-transfer`, {
        method: 'POST',
        body,
      }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketKey(ticketId) }),
        queryClient.invalidateQueries({ queryKey: ticketsKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: workloadKey(sectorId) }),
        queryClient.invalidateQueries({ queryKey: closedTicketsKey }),
        queryClient.invalidateQueries({ queryKey: historyKey }),
      ]),
  })
}

// Coloca o emoji onde está o cursor do campo (trocando a seleção) e devolve o cursor para logo depois
// dele; `change` grava o novo texto. Usada pelo compositor e pela edição, para os dois se comportarem
// igual.
export function insertEmojiAtCursor(
  field: HTMLTextAreaElement | null,
  text: string,
  emoji: string,
  change: (value: string) => void,
) {
  if (!field) return
  const start = field.selectionStart
  const end = field.selectionEnd
  change(text.slice(0, start) + emoji + text.slice(end))
  requestAnimationFrame(() => {
    field.focus()
    field.setSelectionRange(start + emoji.length, start + emoji.length)
  })
}
