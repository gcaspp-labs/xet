import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

// SearchBox do design system: largura máxima de 260px e busca imediata, sem botão.
export function SearchBox({
  value,
  onChange,
  label,
  placeholder,
  autoFocus = false,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
  // A busca recebe o foco ao abrir a janela, como no "Enviar contato".
  autoFocus?: boolean
}) {
  return (
    <div className="relative w-full max-w-[260px]">
      <Search
        strokeWidth={1.7}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-[11px] size-[15px] -translate-y-1/2 text-ink-faint"
      />
      <Input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        className="pl-[32px] [&::-webkit-search-cancel-button]:appearance-none"
      />
    </div>
  )
}
