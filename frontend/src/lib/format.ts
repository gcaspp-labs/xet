import { format, isToday } from 'date-fns'
import type { Sector } from '@/lib/admin'
import type { Role } from '@/lib/auth'

// Telefone com DDI no formato pt-BR: 5511999990000 → +55 (11) 99999-0000.
export function formatPhone(digits: string) {
  const match = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits)
  if (!match) {
    return `+${digits}`
  }
  return `+55 (${match[1]}) ${match[2]}-${match[3]}`
}

export const roleLabels: Record<Role, string> = {
  agent: 'Atendente',
  supervisor: 'Supervisor',
  admin: 'Administrador',
}

// CNPJ sem pontuação no formato pt-BR: 11222333000181 → 11.222.333/0001-81.
// Vale também para o CNPJ alfanumérico (12.ABC.345/01DE-35).
export function formatCnpj(cnpj: string) {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
}

// Remove a pontuação e passa as letras para maiúsculas, como o backend grava.
// O nome sozinho é ambíguo entre cidades (spec.md, Órgãos e contatos).
export function organizationLabel(name: string, municipality: string | null) {
  return municipality ? `${name} — ${municipality}` : name
}

// Para comparar textos sem diferenciar maiúsculas e acentos.
export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export function normalizeCnpj(value: string) {
  return value.replace(/[\s./-]/g, '').toUpperCase()
}

// Dígito verificador do módulo 11, com pesos de 2 a 9 da direita para a esquerda
// e cada caractere valendo o código ASCII menos 48 (regra do CNPJ alfanumérico).
function cnpjCheckDigit(prefix: string) {
  let sum = 0
  let weight = 2
  for (let i = prefix.length - 1; i >= 0; i--) {
    sum += (prefix.charCodeAt(i) - 48) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const rest = sum % 11
  return rest < 2 ? '0' : String(11 - rest)
}

// Valida o CNPJ numérico e o alfanumérico; o backend repete a validação.
export function isValidCnpj(value: string) {
  const cnpj = normalizeCnpj(value)
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj) || /^(.)\1+$/.test(cnpj)) {
    return false
  }
  return (
    cnpjCheckDigit(cnpj.slice(0, 12)) === cnpj[12] && cnpjCheckDigit(cnpj.slice(0, 13)) === cnpj[13]
  )
}

// Remove a formatação do telefone, como o backend grava.
export function normalizePhone(value: string) {
  return value.replace(/[\s()+.-]/g, '')
}

export const connectionLabels: Record<
  Sector['connectionStatus'],
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  connected: { label: 'Conectado', tone: 'success' },
  connecting: { label: 'Conectando', tone: 'warning' },
  disconnected: { label: 'Desconectado', tone: 'neutral' },
  logged_out: { label: 'Requer QR code', tone: 'danger' },
}

// Data e hora no formato pt-BR: 02/03/2026 14:05.
export function formatDateTime(value: string) {
  return format(new Date(value), 'dd/MM/yyyy HH:mm')
}

// Hora da mensagem: só a hora quando é de hoje (14:05), senão dia e hora (02/03 14:05).
export function formatMessageTime(value: string) {
  const date = new Date(value)
  return format(date, isToday(date) ? 'HH:mm' : 'dd/MM HH:mm')
}

export const ticketStatusLabels: Record<
  'queued' | 'in_progress' | 'closed',
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  queued: { label: 'Na fila', tone: 'warning' },
  in_progress: { label: 'Em atendimento', tone: 'success' },
  closed: { label: 'Encerrado', tone: 'neutral' },
}

export const closureTypeLabels: Record<'resolved' | 'transferred' | 'cancelled', string> = {
  resolved: 'Encerrado',
  transferred: 'Transferido',
  cancelled: 'Cancelado',
}

// Situação do chamado; o cancelado é identificado como tal (spec.md, Cancelamento).
export function ticketStatusLabel(
  status: keyof typeof ticketStatusLabels,
  closureType: keyof typeof closureTypeLabels | null,
) {
  return closureType === 'cancelled'
    ? { label: closureTypeLabels.cancelled, tone: 'neutral' as const }
    : ticketStatusLabels[status]
}

// Tamanho de arquivo em pt-BR: 820 KB, 1,4 MB.
export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

// Duração de áudio em minutos e segundos: 75 → 1:15.
export function formatDuration(seconds: number) {
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
