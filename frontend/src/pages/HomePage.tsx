import { PageContent, Topbar } from '@/components/Topbar'
import { useCurrentUser } from '@/lib/auth'

// Tela provisória após o login: o painel de atendimento chega nas próximas tasks.
export default function HomePage() {
  const { data: user } = useCurrentUser()

  return (
    <>
      <Topbar title="Início" />
      <PageContent>
        <p className="text-muted-foreground">Sessão iniciada como {user?.name}.</p>
      </PageContent>
    </>
  )
}
