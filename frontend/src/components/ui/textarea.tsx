import * as React from "react"
import { cn } from "cn"

// Adaptado ao design system (design.md): mesma aparência do Input, raio radius-7
// e foco trocando a borda para accent.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full min-w-0 rounded-(--radius-7) border border-input bg-card px-[11px] py-2 text-[13px] text-foreground transition-colors outline-none placeholder:text-ink-faint focus:border-primary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
