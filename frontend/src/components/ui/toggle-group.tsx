import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { cn } from "cn"

// Chip do design system (design.md): seleção única; ativo em accent com on-accent.
function ToggleGroup({ className, ...props }: ToggleGroupPrimitive.Props) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn("flex flex-wrap gap-1.5", className)}
      {...props}
    />
  )
}

function ToggleGroupItem({ className, ...props }: TogglePrimitive.Props) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        "rounded-(--radius-pill) border border-input bg-card px-3 py-[5px] text-[calc(12px*var(--text-scale))] font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
