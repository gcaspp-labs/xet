// PROTÓTIPO #258 (descartável): campo de senha com o botão de olho dentro, à direita.
// A implementação reescreve isto em components/ui/password-input.tsx a partir das capturas.
import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from 'cn'
import { Input } from '@/components/ui/input'

type ProtoState = 'hover' | 'focus'

type Props = Omit<React.ComponentProps<'input'>, 'type'> & {
  // Só no protótipo: força o visual de hover ou de foco do botão para a captura.
  protoState?: ProtoState
  protoVisible?: boolean
}

export function PasswordInput({ className, disabled, protoState, protoVisible, ref, ...props }: Props) {
  const [visible, setVisible] = React.useState(protoVisible ?? false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  // Ao enviar o formulário, a senha volta a ficar escondida.
  React.useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return
    const hide = () => setVisible(false)
    form.addEventListener('submit', hide)
    return () => form.removeEventListener('submit', hide)
  }, [])

  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  const Icon = visible ? EyeOff : Eye

  return (
    <div className="relative w-full">
      <Input
        ref={setRefs}
        type={visible ? 'text' : 'password'}
        disabled={disabled}
        // 36px à direita: 28px do botão + 3px de folga + 5px até o texto.
        className={cn('pr-9 [&::-ms-reveal]:hidden', className)}
        {...props}
      />
      <button
        type="button"
        disabled={disabled}
        aria-pressed={visible}
        aria-controls={props.id}
        onClick={() => setVisible((v) => !v)}
        className={cn(
          'absolute top-1/2 right-[3px] inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-(--radius-6) text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 focus-visible:-outline-offset-2',
          protoState === 'hover' && 'bg-muted text-foreground',
          protoState === 'focus' && 'outline-2 -outline-offset-2 outline-(--focus) outline-solid',
        )}
      >
        <Icon className="size-[15px]" strokeWidth={1.7} aria-hidden />
        <span className="sr-only">{visible ? 'Ocultar senha' : 'Mostrar senha'}</span>
      </button>
    </div>
  )
}
