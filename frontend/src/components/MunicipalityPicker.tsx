import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import type { MunicipalityRef } from '@/lib/directory'
import { normalizeSearch } from '@/lib/format'

// São até 645 municípios: a lista vem inteira e é filtrada na tela, sem diferenciar acentos.
export function MunicipalityPicker({
  id,
  label,
  placeholder = 'Busque pelo nome',
  clearLabel,
  municipalities,
  value,
  onChange,
  invalid = false,
}: {
  id?: string
  label?: string
  placeholder?: string
  clearLabel?: string
  municipalities: MunicipalityRef[]
  value: MunicipalityRef | null
  onChange: (value: MunicipalityRef | null) => void
  invalid?: boolean
}) {
  return (
    <Combobox
      items={municipalities}
      value={value}
      onValueChange={onChange}
      itemToStringLabel={(municipality: MunicipalityRef) => municipality.name}
      isItemEqualToValue={(a: MunicipalityRef, b: MunicipalityRef) => a.id === b.id}
      filter={(municipality: MunicipalityRef, query: string) =>
        normalizeSearch(municipality.name).includes(normalizeSearch(query))
      }
    >
      <ComboboxInput
        id={id}
        aria-label={label}
        placeholder={placeholder}
        aria-invalid={invalid}
        clearLabel={clearLabel}
      />
      <ComboboxContent>
        <ComboboxEmpty>Nenhum município encontrado.</ComboboxEmpty>
        <ComboboxList>
          {(municipality: MunicipalityRef) => (
            <ComboboxItem key={municipality.id} value={municipality}>
              {municipality.name}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
