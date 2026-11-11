import { Navigate, Outlet, Route, Routes } from 'react-router'
import AppLayout from '@/components/AppLayout'
import { type Role, useCurrentUser } from '@/lib/auth'
import DashboardPage from '@/pages/DashboardPage'
import LoginPage from '@/pages/LoginPage'
import PanelPage from '@/pages/PanelPage'
import ModulesPage from '@/pages/admin/ModulesPage'
import SubjectsPage from '@/pages/admin/SubjectsPage'
import SectorsPage from '@/pages/admin/SectorsPage'
import UsersPage from '@/pages/admin/UsersPage'
import ConnectionPage from '@/pages/connection/ConnectionPage'
// PROTÓTIPO #126: a rota /contatos mostra o protótipo de paginação.
import ContactsPage from '@/pages/directory/ContactsPage.prototype'
import OrganizationsPage from '@/pages/directory/OrganizationsPage'
import TicketPage from '@/pages/ticket/TicketPage'

// Rotas que exigem sessão; sem sessão, vai para o login.
function RequireAuth() {
  const { data: user, isPending } = useCurrentUser()
  if (isPending) {
    return null
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

// Rotas restritas a papéis; os demais voltam ao início. O backend também recusa.
function RequireRole({ roles }: { roles: Role[] }) {
  const { data: user } = useCurrentUser()
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<PanelPage />} />
          <Route path="/chamados/:ticketId" element={<TicketPage />} />
          <Route path="/contatos" element={<ContactsPage />} />
          <Route path="/orgaos" element={<OrganizationsPage />} />
          <Route element={<RequireRole roles={['supervisor', 'admin']} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/modulos" element={<ModulesPage />} />
            <Route path="/assuntos" element={<SubjectsPage />} />
            <Route path="/conexao" element={<ConnectionPage />} />
          </Route>
          <Route element={<RequireRole roles={['admin']} />}>
            <Route path="/admin/setores" element={<SectorsPage />} />
            <Route path="/admin/usuarios" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
