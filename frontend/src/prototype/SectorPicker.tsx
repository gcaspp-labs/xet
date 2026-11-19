// PROTÓTIPO #222: descartável, não vai para a main.
// Quatro versões do seletor de setor do admin no cabeçalho de Chamados, por `?variant=` (A a D),
// na rota /chamados (?as=admin). Mesmo seletor e mesma regra; só muda como ele aparece.
// A (recomendada) "Setor: Tributos" dentro do seletor · B rótulo ao lado · C sem rótulo, com ícone
// · D setor como texto e troca pelo menu ⋯ do setor.
import { Building2, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Item = { value: string; label: string }
type Props = { items: Item[]; value: string | null; onChange: (value: string) => void }

const variants = [
  { id: 'A', label: 'A (setor dentro do seletor)' },
  { id: 'B', label: 'B (rótulo ao lado)' },
  { id: 'C', label: 'C (sem rótulo, com ícone)' },
  { id: 'D', label: 'D (texto + menu ⋯)' },
  { id: 'hoje', label: 'Hoje (main, para comparar)' },
]

function Options({ items }: { items: Item[] }) {
  return (
    <SelectContent>
      {items.map((item) => (
        <SelectItem key={item.value} value={item.value}>
          {item.label}
        </SelectItem>
      ))}
    </SelectContent>
  )
}

// Hoje: como está na main, rótulo acima do seletor.
function Today({ items, value, onChange }: Props) {
  return (
    <Field className="w-[200px]">
      <FieldLabel htmlFor="conversas-sector">Setor</FieldLabel>
      <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger id="conversas-sector">
          <SelectValue />
        </SelectTrigger>
        <Options items={items} />
      </Select>
    </Field>
  )
}

// A: o setor atual dentro do seletor, com o prefixo "Setor:". Nome acessível "Setor".
function VariantA({ items, value, onChange }: Props) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger aria-label="Setor" className="w-[240px]">
        <span className="text-muted-foreground">Setor:</span>
        <SelectValue className="truncate" />
      </SelectTrigger>
      <Options items={items} />
    </Select>
  )
}

// B: o rótulo "Setor" continua, mas ao lado do seletor, na mesma linha.
function VariantB({ items, value, onChange }: Props) {
  return (
    <Field orientation="horizontal" className="w-auto items-center gap-2">
      <FieldLabel htmlFor="conversas-sector" className="shrink-0">
        Setor
      </FieldLabel>
      <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger id="conversas-sector" className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <Options items={items} />
      </Select>
    </Field>
  )
}

// C: sem rótulo visível; o ícone de setor (o mesmo do menu Setores) diz o que é.
function VariantC({ items, value, onChange }: Props) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger aria-label="Setor" title="Setor" className="w-[220px]">
        <Building2 strokeWidth={1.7} aria-hidden className="text-muted-foreground" />
        <SelectValue className="truncate" />
      </SelectTrigger>
      <Options items={items} />
    </Select>
  )
}

// D: o setor é só texto no cabeçalho; trocar fica num menu ⋯ próprio, ao lado.
function VariantD({ items, value, onChange }: Props) {
  const current = items.find((item) => item.value === value)
  return (
    <div className="flex items-center gap-1">
      <span className="text-sm text-muted-foreground">
        Setor: <span className="font-medium text-foreground">{current?.label}</span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Setor" title="Trocar setor" />
          }
        >
          <MoreHorizontal strokeWidth={1.7} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Ver o setor</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={value ?? ''} onValueChange={(v) => onChange(String(v))}>
              {items.map((item) => (
                <DropdownMenuRadioItem key={item.value} value={item.value}>
                  {item.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function Switcher({ current, set }: { current: number; set: (i: number) => void }) {
  const go = (step: number) => set((current + step + variants.length) % variants.length)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement
      if (el.closest('input, textarea, [contenteditable]')) return
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  return (
    <div
      data-prototype-switcher
      className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border-2 border-dashed border-fuchsia-500 bg-black px-3 py-1.5 font-mono text-xs text-white shadow-lg"
    >
      <button type="button" onClick={() => go(-1)} aria-label="Versão anterior">
        <ChevronLeft className="size-4" />
      </button>
      <span>PROTÓTIPO #222 · {variants[current].label}</span>
      <button type="button" onClick={() => go(1)} aria-label="Próxima versão">
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

export function SectorPicker(props: Props) {
  const [params, setParams] = useSearchParams()
  const index = Math.max(0, variants.findIndex((v) => v.id === params.get('variant')))
  const set = (i: number) => {
    const next = new URLSearchParams(params)
    next.set('variant', variants[i].id)
    setParams(next, { replace: true })
  }
  const id = variants[index].id
  return (
    <>
      {id === 'A' && <VariantA {...props} />}
      {id === 'B' && <VariantB {...props} />}
      {id === 'C' && <VariantC {...props} />}
      {id === 'D' && <VariantD {...props} />}
      {id === 'hoje' && <Today {...props} />}
      {import.meta.env.DEV && <Switcher current={index} set={set} />}
    </>
  )
}
