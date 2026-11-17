// PROTÓTIPO #239: telefone do cliente + botão de copiar só o telefone. Descartável.
// Um protótipo, uma versão (ajuste de tela existente): cabeçalho de /chamados/:id e ficha /atendimentos/:id.
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/format'

// Formato de discagem pedido por Laboratório (17/11): só números, 0 + DDD + número, sem o +55.
// 5561987654321 → 061987654321. Número de fora do Brasil: só os dígitos, como estão.
export function dialPhone(digits: string) {
  const match = /^55(\d{2})(\d{8,9})$/.exec(digits)
  return match ? `0${match[1]}${match[2]}` : digits.replace(/\D/g, '')
}

// Mesmo padrão de cópia e aviso de SubjectsTab.tsx.
async function copyPhone(phone: string) {
  try {
    if (new URLSearchParams(window.location.search).get('falha') === '1') throw new Error('falha')
    await navigator.clipboard.writeText(phone)
    toast.success('Telefone copiado')
  } catch {
    toast.error('Não foi possível copiar o telefone.')
  }
}

export function PhoneCopy({ phone }: { phone: string | null | undefined }) {
  if (!phone) return <span className="mono-num block caption text-ink-faint">Sem telefone</span>
  const shown = formatPhone(phone)
  return (
    <span className="flex items-center gap-1">
      <span className="mono-num caption text-ink-faint">{shown}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Copiar telefone"
        title="Copiar telefone"
        className="-my-1 size-6 text-ink-soft hover:text-foreground"
        onClick={() => void copyPhone(dialPhone(phone))}
      >
        <Copy strokeWidth={1.7} aria-hidden />
      </Button>
    </span>
  )
}
