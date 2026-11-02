"use client"

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { cn } from "cn"

// Campo de busca com lista, com a mesma aparência do Input e do Select
// (FormField do design system). Só as partes usadas pelo sistema.
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react"

const Combobox = ComboboxPrimitive.Root

function ComboboxInput({
  className,
  clearLabel,
  ...props
}: ComboboxPrimitive.Input.Props & { clearLabel?: string }) {
  return (
    <div data-slot="combobox-control" className="relative w-full">
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className={cn(
          "w-full min-w-0 rounded-(--radius-7) border border-input bg-card py-2 pr-9 pl-[11px] text-[13px] text-foreground transition-colors outline-none placeholder:text-ink-faint focus:border-primary disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
          clearLabel && "pr-16",
          className
        )}
        {...props}
      />
      {clearLabel && (
        <ComboboxPrimitive.Clear
          data-slot="combobox-clear"
          aria-label={clearLabel}
          className="absolute inset-y-0 right-8 flex w-7 items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
        >
          <XIcon strokeWidth={1.7} className="pointer-events-none size-[15px]" />
        </ComboboxPrimitive.Clear>
      )}
      <ComboboxPrimitive.Trigger
        data-slot="combobox-trigger"
        aria-label="Abrir lista"
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground outline-none"
      >
        <ChevronDownIcon strokeWidth={1.7} className="pointer-events-none size-4" />
      </ComboboxPrimitive.Trigger>
    </div>
  )
}

function ComboboxContent({
  className,
  sideOffset = 4,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, "sideOffset">) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side="bottom"
        align="start"
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-(--shadow) ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "max-h-72 scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0",
        className
      )}
      {...props}
    />
  )
}

function ComboboxItem({
  className,
  children,
  ...props
}: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon strokeWidth={1.7} className="pointer-events-none size-4" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "hidden w-full justify-center py-2 text-center text-sm text-ink-faint group-data-empty/combobox-content:flex",
        className
      )}
      {...props}
    />
  )
}

export { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList }
