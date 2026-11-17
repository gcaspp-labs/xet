// PROTÓTIPO #247: descartável, não vai para a main.
// "Uma proposta da janela Outro setor, no padrão do TransferSheet, com os estados trocados por
// ?estado= na rota /chamados/:id." Nada é gravado: Transferir só simula o envio.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { FormDialog } from '@/components/FormDialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { type TicketDetail, useTransferSectors } from '@/lib/conversation'

export const states = [
  ['vazia', 'Janela aberta'],
  ['setor', 'Setor escolhido'],
  ['motivo', 'Com motivo'],
  ['enviando', 'Enviando'],
  ['erro', 'Chamado aberto no destino'],
  ['sem-setores', 'Sem setores'],
] as const

const conflict = 'O contato já tem chamado aberto no setor de destino. Nada foi transferido.'

export function SectorTransferSheet({
  ticket,
  open,
  onOpenChange,
  onSuccess,
}: {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const [params] = useSearchParams()
  const state = params.get('estado') ?? 'vazia'
  const { data: sectors } = useTransferSectors(ticket.id, open)
  const [target, setTarget] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  // Cada estado do protótipo começa a janela num ponto do fluxo.
  useEffect(() => {
    setTarget(state === 'vazia' || state === 'sem-setores' ? null : '2')
    setReason(
      state === 'motivo' || state === 'enviando' || state === 'erro'
        ? 'Pedido de segunda via de guia do ISS: é com Tributos.'
        : '',
    )
    setPending(state === 'enviando')
    setError(state === 'erro' ? conflict : undefined)
  }, [state])

  const items = (sectors ?? []).map((s) => ({ value: String(s.id), label: s.name }))
  const empty = sectors !== undefined && sectors.length === 0

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    if (!target) {
      setError('Escolha o setor de destino.')
      return
    }
    setError(undefined)
    setPending(true)
    setTimeout(() => {
      setPending(false)
      toast.success('Chamado transferido para outro setor')
      onOpenChange(false)
      onSuccess?.()
    }, 1200)
  }

  return (
    <FormDialog
      locked
      open={open}
      onOpenChange={onOpenChange}
      title="Transferir para outro setor"
      description="A etapa deste setor é encerrada como Transferido, e um novo chamado, com o mesmo contato, entra na fila do destino."
      submitLabel={empty ? undefined : 'Transferir'}
      cancelLabel={empty ? 'Fechar' : 'Cancelar'}
      pending={pending}
      error={error}
      onSubmit={submit}
    >
      <Field>
        <FieldLabel htmlFor="sector-transfer-target">Setor de destino</FieldLabel>
        <Select
          items={items}
          value={target}
          disabled={pending || empty}
          onValueChange={(value) => setTarget(value)}
        >
          <SelectTrigger id="sector-transfer-target">
            <SelectValue placeholder="Escolha o setor" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {empty && <FieldDescription>Não há outro setor ativo para receber o chamado.</FieldDescription>}
      </Field>
      {!empty && (
        <Field>
          <FieldLabel htmlFor="sector-transfer-reason">Motivo da transferência (opcional)</FieldLabel>
          <Textarea
            id="sector-transfer-reason"
            maxLength={2000}
            disabled={pending}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <FieldDescription>
            O setor de destino vê o motivo no chamado, e ele aparece na conversa dos dois chamados.
          </FieldDescription>
        </Field>
      )}
    </FormDialog>
  )
}

// Barra do protótipo: troca o estado pela URL; ← e → também, fora de campos de texto.
export function PrototypeSwitcher() {
  const [params, setParams] = useSearchParams()
  
  const current = Math.max(
    0,
    states.findIndex(([id]) => id === (params.get('estado') ?? 'vazia')),
  )
  const go = (delta: number) => {
    const next = new URLSearchParams(params)
    next.set('estado', states[(current + delta + states.length) % states.length][0])
    setParams(next)
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el?.closest('input, textarea, [contenteditable]')) return
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (!import.meta.env.DEV) return null
  return (
    <div
      data-prototype-switcher
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 999,
        background: '#111',
        color: '#ff0',
        font: '600 13px monospace',
        border: '2px dashed #ff0',
        pointerEvents: 'auto',
      }}
    >
      <button type="button" onClick={() => go(-1)} aria-label="Estado anterior">
        <ChevronLeft size={16} />
      </button>
      PROTÓTIPO · {current + 1}/{states.length} {states[current][1]}
      <button type="button" onClick={() => go(1)} aria-label="Próximo estado">
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
