import { OrganizationPicker } from '@/components/ContactSheet'
import { MunicipalityPicker } from '@/components/MunicipalityPicker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSectors } from '@/lib/admin'
import {
  allContacts,
  useActiveModules,
  type ContactFilterState,
  useOrganizationMunicipalities,
} from '@/lib/directory'

export function ContactFilters({
  ownSector,
  sector,
  module,
  municipality,
  organization,
  filter,
  setSector,
  setModule,
  setMunicipality,
  setOrganization,
}: ContactFilterState) {
  const { data: sectors = [] } = useSectors()
  // Sem setor escolhido, atendente e supervisor filtram pelos módulos do próprio setor.
  const { data: modules = [] } = useActiveModules(filter.sectorId ?? ownSector)
  const { data: municipalities = [] } = useOrganizationMunicipalities()

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
      <div className="w-[200px]">
        <MunicipalityPicker
          label="Filtrar por município"
          placeholder="Todos os municípios"
          clearLabel="Limpar município"
          municipalities={municipalities}
          value={municipality}
          onChange={setMunicipality}
        />
      </div>
      <div className="w-[260px] max-w-full">
        {/* Nova chave a cada município e órgão: o texto do campo acompanha o órgão que
            restou ou o que chegou do endereço depois de a tela abrir. */}
        <OrganizationPicker
          key={`${filter.municipalityId ?? allContacts}-${organization?.id ?? allContacts}`}
          label="Filtrar por órgão"
          placeholder="Todos os órgãos"
          clearLabel="Limpar órgão"
          municipalityId={filter.municipalityId}
          value={organization}
          onChange={setOrganization}
        />
      </div>
    </div>
  )
}
