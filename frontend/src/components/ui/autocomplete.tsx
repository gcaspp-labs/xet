"use client"

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete"
import { cn } from "cn"

// Campo de texto com sugestões, que aceita um texto fora da lista, com a mesma
// aparência do Combobox (design.md, Assunto do formulário). Só as partes usadas
// pelo sistema.
import { ChevronDownIcon } from "lucide-react"

const Autocomplete = AutocompletePrimitive.Root

function AutocompleteInput({ className, ...props }: AutocompletePrimitive.Input.Props) {
  return (
    <div data-slot="autocomplete-control" className="relative w-full">
      <AutocompletePrimitive.Input
        data-slot="autocomplete-input"
        className={cn(
          "w-full min-w-0 rounded-(--radius-7) border border-input bg-card py-2 pr-9 pl-[11px] text-[calc(13px*var(--text-scale))] text-foreground transition-colors outline-none placeholder:text-ink-faint focus:border-primary disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
          className
        )}
        {...props}
      />
      <AutocompletePrimitive.Trigger
        data-slot="autocomplete-trigger"
        aria-label="Abrir lista"
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground outline-none"
      >
        <ChevronDownIcon strokeWidth={1.7} className="pointer-events-none size-4" />
      </AutocompletePrimitive.Trigger>
    </div>
  )
}

function AutocompleteContent({
  className,
  sideOffset = 4,
  ...props
}: AutocompletePrimitive.Popup.Props &
  Pick<AutocompletePrimitive.Positioner.Props, "sideOffset">) {
  return (
    <AutocompletePrimitive.Portal>
      <AutocompletePrimitive.Positioner
        side="bottom"
        align="start"
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <AutocompletePrimitive.Popup
          data-slot="autocomplete-content"
          className={cn(
            "relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-(--shadow) ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </AutocompletePrimitive.Positioner>
    </AutocompletePrimitive.Portal>
  )
}

function AutocompleteList({ className, ...props }: AutocompletePrimitive.List.Props) {
  return (
    <AutocompletePrimitive.List
      data-slot="autocomplete-list"
      className={cn(
        "max-h-72 scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0",
        className
      )}
      {...props}
    />
  )
}

function AutocompleteItem({ className, ...props }: AutocompletePrimitive.Item.Props) {
  return (
    <AutocompletePrimitive.Item
      data-slot="autocomplete-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 px-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Autocomplete, AutocompleteContent, AutocompleteInput, AutocompleteItem, AutocompleteList }
