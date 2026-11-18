import { Eye, EyeOff } from 'lucide-react'
import * as React from 'react'
import { cn } from 'cn'
import { Input } from '@/components/ui/input'

type PasswordInputProps = Omit<React.ComponentProps<'input'>, 'type'>

// Campo de senha com o botão de olho dentro, à direita. A senha começa escondida e
// volta a ficar escondida quando o formulário do campo é enviado.
export function PasswordInput({ className, disabled, ref, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

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
        // 36px à direita: 28px do botão + 3px de folga + 5px até o texto. O olho nativo
        // do Edge some para não aparecer em dobro.
        className={cn('pr-9 [&::-ms-reveal]:hidden', className)}
        {...props}
      />
      {/* O nome vem do texto sr-only, não de aria-label, para getByLabel('Senha') achar só o campo. */}
      <button
        type="button"
        disabled={disabled}
        aria-pressed={visible}
        aria-controls={props.id}
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-[3px] inline-flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-(--radius-6) text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        <Icon className="size-[15px]" strokeWidth={1.7} aria-hidden />
        <span className="sr-only">{visible ? 'Ocultar senha' : 'Mostrar senha'}</span>
      </button>
    </div>
  )
}
