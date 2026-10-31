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
