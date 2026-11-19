import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { dialPhone, formatPhone } from '@/lib/format'

// Mesmo padrão de cópia e aviso de SubjectsTab.tsx.
async function copyPhone(phone: string) {
  try {
    await navigator.clipboard.writeText(dialPhone(phone))
    toast.success('Telefone copiado')
  } catch {
    toast.error('Não foi possível copiar o telefone.')
  }
}

// Telefone do cliente com o botão que copia só o telefone, no formato de discagem.
export function PhoneCopy({ phone }: { phone: string | null | undefined }) {
  if (!phone) {
    return <span className="mono-num block caption text-ink-faint">Sem telefone</span>
  }
  return (
    <span className="flex items-center gap-1">
      <span className="mono-num caption text-ink-faint">{formatPhone(phone)}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Copiar telefone"
        title="Copiar telefone"
        className="-my-1 size-6 text-ink-soft hover:text-foreground"
        onClick={() => void copyPhone(phone)}
      >
        <Copy strokeWidth={1.7} aria-hidden />
      </Button>
    </span>
  )
}
