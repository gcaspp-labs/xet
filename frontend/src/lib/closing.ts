import { format } from 'date-fns'
import { z } from 'zod'

// Valor de <input type="datetime-local"> no horário do navegador: 2026-03-02T14:05.
export const localInput = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm")

// Campos do formulário de encerramento, comuns ao encerramento, à
// transferência entre setores e à correção (spec.md, Formulário de encerramento).
export const closingShape = {
  subject: z.string().trim().min(1, 'Informe o assunto.'),
  resolution: z.string().trim().min(1, 'Informe a resolução.'),
  moduleIds: z.array(z.number()).min(1, 'Selecione ao menos um módulo.'),
  organization: z
    .object({ id: z.number(), name: z.string(), cnpj: z.string().nullable() })
    .nullable()
    .refine((value) => value !== null, 'Selecione o órgão do atendimento.'),
  startedAt: z.string().min(1, 'Informe o início.'),
  endedAt: z.string().min(1, 'Informe o fim.'),
}

export const closingSchema = z.object(closingShape)

// O fim não pode estar no futuro nem antes do início; o backend confere de novo.
export function checkPeriod(values: { startedAt: string; endedAt: string }, ctx: z.RefinementCtx) {
  if (new Date(values.endedAt) > new Date()) {
    ctx.addIssue({ code: 'custom', path: ['endedAt'], message: 'O fim não pode estar no futuro.' })
  }
  if (values.endedAt < values.startedAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['endedAt'],
      message: 'O fim precisa ser depois do início.',
    })
  }
}
