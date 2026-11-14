import { ArrowLeft, CircleAlert } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { Topbar } from '@/components/Topbar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

// Tela Não encontrado, única para o sistema todo: rota coringa, endereços antigos e chamados
// que não existem ou não cabem no endereço. O texto é genérico, vale para qualquer caso.
export default function NotFoundPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Endereço aberto direto (sem página anterior no app): Voltar vai ao início.
  const goBack = () =>
    location.key === 'default' ? void navigate('/', { replace: true }) : void navigate(-1)
  return (
    <>
      <Topbar title="Não encontrado" />
      <div className="mx-auto flex w-full max-w-(--content-max) flex-col items-start gap-4 px-4 py-4 md:px-[30px] md:py-[30px]">
        <Alert variant="warning">
          <CircleAlert strokeWidth={1.7} aria-hidden />
          <AlertDescription>
            Esta página não existe ou não está disponível neste endereço. Volte ou escolha uma opção
            no menu.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={goBack}>
          <ArrowLeft strokeWidth={1.7} aria-hidden />
          Voltar
        </Button>
      </div>
    </>
  )
}
