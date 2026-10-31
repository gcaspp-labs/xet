import { CircleAlert } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useSectors } from '@/lib/admin'
import { useCurrentUser } from '@/lib/auth'

// Alerta de número desconectado para supervisores e administradores,
// atualizado pelos eventos do WebSocket.
export function DisconnectionNote() {
  const { data: user } = useCurrentUser()
  const { pathname } = useLocation()
  const canConnect = user?.role === 'supervisor' || user?.role === 'admin'
  const { data: sectors = [] } = useSectors()
  if (!canConnect || pathname === '/conexao') {
    return null
  }
  const down = sectors.filter(
    (s) =>
      s.active && (s.connectionStatus === 'disconnected' || s.connectionStatus === 'logged_out'),
  )
  if (down.length === 0) {
    return null
  }
  const message =
    down.length === 1
      ? `Número do setor ${down[0].name} desconectado.`
      : `Números desconectados: ${down.map((s) => s.name).join(', ')}.`

  return (
    <div className="mx-auto w-full max-w-(--content-max) px-4 pt-4 md:px-[30px]">
      <Alert variant="warning">
        <CircleAlert strokeWidth={1.7} aria-hidden />
        <AlertDescription>
          {message}{' '}
          <Link to={down.length === 1 ? `/conexao?setor=${down[0].id}` : '/conexao'}>
            Reconecte pelo QR code.
          </Link>
        </AlertDescription>
      </Alert>
    </div>
  )
}
