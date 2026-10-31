import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useCurrentUser, useLogout } from '@/lib/auth'

// Tela provisória após o login: o painel de atendimento chega nas próximas tasks.
export default function HomePage() {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()

  return (
    <main className="mx-auto flex min-h-svh max-w-(--content-max) flex-col gap-4 px-4 py-8 md:px-[30px]">
      <header className="flex items-center justify-between gap-4">
        <h1 className="title-page">Central de Atendimento</h1>
        <Button
          variant="outline"
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })
          }
        >
          <LogOut strokeWidth={1.7} aria-hidden />
          Sair
        </Button>
      </header>
      <p className="text-muted-foreground">Sessão iniciada como {user?.name}.</p>
    </main>
  )
}
