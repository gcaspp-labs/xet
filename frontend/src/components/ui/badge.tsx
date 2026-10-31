import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Adaptado ao design system (design.md): status = Pill (ponto colorido +
// palavra obrigatória); tag = Tag, para categorias, nunca status.
const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap caption font-medium",
  {
    variants: {
      variant: {
        status:
          "rounded-(--radius-pill) border border-border bg-card px-2 py-px text-foreground before:size-1.5 before:rounded-full before:content-['']",
        tag: "rounded-(--radius-6) bg-accent-soft px-2 py-px text-accent-strong",
      },
      tone: {
        success: "before:bg-success",
        warning: "before:bg-warning",
        danger: "before:bg-danger",
        neutral: "before:bg-ink-faint",
      },
    },
    defaultVariants: {
      variant: "status",
      tone: "neutral",
    },
  }
)

function Badge({
  className,
  variant = "status",
  tone = "neutral",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, tone: variant === "status" ? tone : null }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
