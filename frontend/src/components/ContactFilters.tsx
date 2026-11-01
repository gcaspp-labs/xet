import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSectors } from '@/lib/admin'
import { allContacts, useActiveModules, useContactFilter } from '@/lib/directory'

export function ContactFilters({
  ownSector,
  sector,
  module,
  filter,
  setSector,
  setModule,
}: ReturnType<typeof useContactFilter>) {
  const { data: sectors = [] } = useSectors()
  // Sem setor escolhido, atendente e supervisor filtram pelos módulos do próprio setor.
  const { data: modules = [] } = useActiveModules(filter.sectorId ?? ownSector)

  const sectorItems = [
    { value: allContacts, label: 'Todos os setores' },
    ...(ownSector !== undefined
      ? [{ value: String(ownSector), label: 'Meu setor' }]
      : sectors.map((item) => ({ value: String(item.id), label: item.name }))),
  ]
  const moduleItems = [
    { value: allContacts, label: 'Todos os módulos' },
    ...modules.map((item) => ({ value: String(item.id), label: item.name })),
  ]

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        items={sectorItems}
        value={sector}
        onValueChange={(value) => value && setSector(value)}
      >
        <SelectTrigger aria-label="Filtrar por setor" className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sectorItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {modules.length > 0 && (
        <Select
          items={moduleItems}
          value={module}
          onValueChange={(value) => value && setModule(value)}
        >
          <SelectTrigger aria-label="Filtrar por módulo" className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {moduleItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
