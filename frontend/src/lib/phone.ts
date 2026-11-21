import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { closedTicketsKey } from '@/lib/closed-tickets'
import { type ClosingForm, historyKey } from '@/lib/conversation'
import { dashboardKey } from '@/lib/dashboard'

const phoneFormKey = (sectorId: number, contactId: number) => [
  'sectors',
  sectorId,
  'phone-tickets',
  'form',
  contactId,
]

// Ponto de partida da janela do registro por telefone: os mesmos dados do
// formulário de encerramento, para o contato escolhido no setor.
export function usePhoneForm(sectorId: number | undefined, contactId: number | undefined) {
  return useQuery({
    queryKey: phoneFormKey(sectorId ?? 0, contactId ?? 0),
    queryFn: () =>
      api<ClosingForm>(`/sectors/${sectorId}/phone-tickets/form?contactId=${contactId}`),
    enabled: sectorId !== undefined && contactId !== undefined,
  })
}

// Registra o atendimento por telefone, já encerrado. O identificador da
// requisição faz a nova tentativa devolver o mesmo registro.
export type PhoneRegistration = {
  contactId: number
  organizationId: number
  moduleIds: number[]
  subject: string
  resolution: string
  startedAt: string
  endedAt: string
  clientRequestId: string
  addSubject?: boolean
  addSolution?: boolean
  subjectModuleId?: number
  solutionModuleId?: number
}

export type PhoneRegistrationResult = { id: number; protocol: string }

export function useRegisterPhone(sectorId: number | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: PhoneRegistration) =>
      api<PhoneRegistrationResult>(`/sectors/${sectorId}/phone-tickets`, { method: 'POST', body }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: closedTicketsKey }),
        queryClient.invalidateQueries({ queryKey: historyKey }),
        queryClient.invalidateQueries({ queryKey: dashboardKey }),
      ]),
  })
}
