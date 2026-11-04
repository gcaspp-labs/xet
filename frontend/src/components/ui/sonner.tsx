import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { useTheme } from "@/lib/theme"

// Toast do design system (design.md): rodapé central, ~2,5s, ícone de
// confirmação em success. O tema acompanha a escolha do menu de configurações.
// O CSS do sonner fixa 13px fora de @layer, então só uma utilidade com ! vence e segue o tamanho do texto.
const Toaster = ({ ...props }: ToasterProps) => {
  const [theme] = useTheme()
  return (
    <Sonner
      theme={theme}
      position="bottom-center"
      duration={2500}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon strokeWidth={1.7} className="size-4 text-success" />,
        info: <InfoIcon strokeWidth={1.7} className="size-4" />,
        warning: <TriangleAlertIcon strokeWidth={1.7} className="size-4 text-warning" />,
        error: <OctagonXIcon strokeWidth={1.7} className="size-4 text-danger" />,
        loading: <Loader2Icon strokeWidth={1.7} className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--line)",
          "--border-radius": "var(--radius-8)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast body text-[calc(13px*var(--text-scale))]!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
