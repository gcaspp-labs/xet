import type { User } from '@/lib/auth'
import type { TicketDetail } from '@/lib/conversation'

// Quem é do setor do chamado age nele; o destino de uma transferência entre
// setores só lê os chamados anteriores (spec.md, Transferências).
export function worksIn(ticket: TicketDetail, user: User) {
  return user.role === 'admin' || user.sectorId === ticket.sector.id
}

// Só o responsável conduz a conversa, com o chamado em atendimento; o backend confere de novo.
export function conducts(ticket: TicketDetail, user: User) {
  return ticket.status === 'in_progress' && ticket.assignee?.id === user.id
}

// Só o responsável pelo chamado em atendimento o coloca como pendente (spec #332).
export function canMarkPending(ticket: TicketDetail, user: User) {
  return conducts(ticket, user)
}

// O responsável pelo chamado em atendimento retoma um pendente do contato, pela janela. Na fila
// só o aviso aparece: a ação exige assumir antes, e o backend recusa (spec #332).
export function canResumePending(ticket: TicketDetail, user: User) {
  return conducts(ticket, user) && (ticket.pendingTickets?.length ?? 0) > 0
}

// O responsável transfere o próprio chamado em atendimento; supervisão e
// administração transferem o de qualquer atendente (spec.md, Transferências).
export function canTransfer(ticket: TicketDetail, user: User) {
  return ticket.status === 'in_progress' && (conducts(ticket, user) || user.role !== 'agent')
}

// Só o responsável encerra, como responde (spec.md, Formulário de encerramento).
export function canClose(ticket: TicketDetail, user: User) {
  return ticket.status === 'in_progress' && conducts(ticket, user)
}

// Na fila, quem é do setor cancela; em atendimento, o responsável e a
// supervisão do setor (spec.md, Cancelamento).
export function canCancel(ticket: TicketDetail, user: User) {
  return (
    worksIn(ticket, user) &&
    (ticket.status === 'queued' ||
      (ticket.status === 'in_progress' && (conducts(ticket, user) || user.role !== 'agent')))
  )
}

// Na fila o X cancela sem assumir: qualquer pessoa do setor, e o administrador nos setores que
// enxerga (spec.md, Cancelamento; #395). Os itens da fila são sempre chamados na fila, por isso a
// regra olha só o setor.
export function canCancelFromQueue(sectorId: number, user: User) {
  return user.role === 'admin' || user.sectorId === sectorId
}

// Retoma o pendente quem é do setor dele (o administrador também). O backend confere de novo, e a
// tela não pode oferecer o Retomar a quem ele recusaria (spec #332).
export function canResume(ticket: TicketDetail, user: User) {
  return ticket.status === 'pending' && worksIn(ticket, user)
}

// Devolvem à fila o chamado em atendimento o responsável e a supervisão do
// setor (spec.md, Devolver à fila).
export function canReturn(ticket: TicketDetail, user: User) {
  return (
    worksIn(ticket, user) &&
    ticket.status === 'in_progress' &&
    (conducts(ticket, user) || user.role !== 'agent')
  )
}

// Corrige o atendimento encerrado quem o encerrou e a supervisão do setor; o
// cancelado, o transferido para outro setor e o mesclado num pendente não são
// corrigidos (closing.md, regra 14; spec #332, Mesclar em pendente).
export function canCorrect(ticket: TicketDetail, user: User) {
  return (
    ticket.status === 'closed' &&
    ticket.closureType !== 'cancelled' &&
    ticket.closureType !== 'transferred' &&
    ticket.closureType !== 'merged' &&
    worksIn(ticket, user) &&
    (ticket.closedBy?.id === user.id || user.role !== 'agent')
  )
}
