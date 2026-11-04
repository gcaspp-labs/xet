import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Adaptado ao design system (design.md): default = primário, outline = padrão,
// destructive = texto em danger; foco pelo outline global.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center border font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px]",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground hover:border-accent-strong hover:bg-accent-strong",
        outline: "border-border bg-card text-foreground hover:border-ink-faint",
        ghost: "border-transparent bg-transparent text-foreground hover:bg-muted",
        destructive:
          "border-transparent bg-transparent text-destructive hover:bg-danger-soft",
        link: "border-transparent text-accent-strong underline-offset-4 hover:underline",
      },
      size: {
        default: "gap-[7px] rounded-(--radius-8) px-3.5 py-2 text-[calc(13px*var(--text-scale))]",
        sm: "gap-[5px] rounded-(--radius-7) px-2.5 py-[5px] text-[calc(12.5px*var(--text-scale))]",
        icon: "size-8 rounded-(--radius-7) [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
