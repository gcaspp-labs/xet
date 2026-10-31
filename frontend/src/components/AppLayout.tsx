import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import {
  BookUser,
  Boxes,
  Building2,
  Landmark,
  LogOut,
  MessagesSquare,
  QrCode,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { DisconnectionNote } from '@/components/DisconnectionNote'
import { RealtimeNote } from '@/components/RealtimeNote'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar'
import { type Role, useCurrentUser, useLogout } from '@/lib/auth'
import { roleLabels } from '@/lib/format'
import { useRealtime } from '@/lib/realtime'

type NavItem = { to: string; label: string; icon: LucideIcon; roles: Role[] }

const mainItems: NavItem[] = [
  { to: '/', label: 'Atendimento', icon: MessagesSquare, roles: ['agent', 'supervisor', 'admin'] },
]

// Cadastro único de clientes: todos consultam; o backend restringe a edição de órgãos.
const directoryItems: NavItem[] = [
  { to: '/contatos', label: 'Contatos', icon: BookUser, roles: ['agent', 'supervisor', 'admin'] },
  { to: '/orgaos', label: 'Órgãos', icon: Landmark, roles: ['agent', 'supervisor', 'admin'] },
]

// A interface só reflete as permissões; o backend recusa o acesso de quem não pode.
const adminItems: NavItem[] = [
  { to: '/modulos', label: 'Módulos', icon: Boxes, roles: ['supervisor', 'admin'] },
  { to: '/conexao', label: 'Conexão', icon: QrCode, roles: ['supervisor', 'admin'] },
  { to: '/admin/setores', label: 'Setores', icon: Building2, roles: ['admin'] },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users, roles: ['admin'] },
]

function NavGroup({ label, items, role }: { label?: string; items: NavItem[]; role: Role }) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const visible = items.filter((item) => item.roles.includes(role))
  if (visible.length === 0) {
    return null
  }
  return (
    <SidebarGroup>
      {label && (
        <SidebarGroupLabel className="overline text-sidebar-foreground/70">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {visible.map((item) => (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton
                isActive={pathname === item.to}
                render={<NavLink to={item.to} onClick={() => setOpenMobile(false)} />}
              >
                <item.icon strokeWidth={1.7} className="size-[17px]!" aria-hidden />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export default function AppLayout() {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()
  const online = useRealtime()
  if (!user) {
    return null
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-4 py-4">
          <div className="flex items-center gap-2.5">
            <img src={symbol} alt="" className="size-8" />
            <div className="min-w-0">
              <p className="body-strong text-sidebar-text-active">GCASPP LAB</p>
              <p className="caption">Central de Atendimento</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <NavGroup items={mainItems} role={user.role} />
          <NavGroup label="Cadastro" items={directoryItems} role={user.role} />
          <NavGroup label="Administração" items={adminItems} role={user.role} />
        </SidebarContent>
        <SidebarFooter className="gap-3 border-t border-sidebar-border px-4 py-3">
          <div className="min-w-0">
            <p className="body-strong truncate text-sidebar-text-active">{user.name}</p>
            <p className="caption">{roleLabels[user.role]}</p>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                disabled={logout.isPending}
                onClick={() =>
                  logout.mutate(undefined, {
                    onSuccess: () => navigate('/login', { replace: true }),
                  })
                }
              >
                <LogOut strokeWidth={1.7} className="size-[17px]!" aria-hidden />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <p className="caption text-sidebar-foreground/60">g-lab</p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        {!online && <RealtimeNote />}
        <DisconnectionNote />
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
