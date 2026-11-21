import { Phone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// Canal do atendimento: só o registro por telefone ganha marca, a Tag "Telefone"
// com o ícone (categoria, não situação); os de WhatsApp ficam como sempre. Modelo
// oficial da marca na lista de Atendimentos (design da #320).
export function TelefoneTag({ className }: { className?: string }) {
  return (
    <Badge variant="tag" className={className}>
      <Phone strokeWidth={1.7} aria-hidden className="size-3" />
      Telefone
    </Badge>
  )
}
