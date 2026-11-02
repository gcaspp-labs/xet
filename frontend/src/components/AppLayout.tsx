import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import {
  BookUser,
  Boxes,
  Building2,
  Landmark,
  LogOut,
  MessagesSquare,
  Monitor,
  Moon,
  QrCode,
  Settings,
  Sun,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { DisconnectionNote } from '@/components/DisconnectionNote'
import { RealtimeNote } from '@/components/RealtimeNote'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { type Theme, useTheme } from '@/lib/theme'

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
                tooltip={item.label}
                isActive={
                  pathname === item.to || (item.to === '/' && pathname.startsWith('/chamados/'))
                }
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

const themeItems: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

function SettingsMenu() {
  const [theme, setTheme] = useTheme()
  const logout = useLogout()
  const navigate = useNavigate()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton />}>
        <Settings strokeWidth={1.7} className="size-[15px]!" aria-hidden />
        <span>Configurações</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tema</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
            {themeItems.map((item) => (
              <DropdownMenuRadioItem key={item.value} value={item.value}>
                <item.icon strokeWidth={1.7} aria-hidden />
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={logout.isPending}
          onClick={() =>
            logout.mutate(undefined, {
              onSuccess: () => navigate('/login', { replace: true }),
            })
          }
        >
          <LogOut strokeWidth={1.7} aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function AppLayout() {
  const { data: user } = useCurrentUser()
  const online = useRealtime()
  if (!user) {
    return null
  }

  return (
    <SidebarProvider defaultOpen={!document.cookie.includes('sidebar_state=false')}>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-4 py-4 group-data-[collapsible=icon]:px-2">
          <div className="flex items-center gap-2.5">
            <img src={symbol} alt="" className="size-8 shrink-0 dark:hidden" />
            <img src={symbolDark} alt="" className="hidden size-8 shrink-0 dark:block" />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
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
        <SidebarFooter className="gap-3 border-t border-sidebar-border px-4 py-3 group-data-[collapsible=icon]:px-2">
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="body-strong truncate text-sidebar-text-active">{user.name}</p>
            <p className="caption">{roleLabels[user.role]}</p>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SettingsMenu />
            </SidebarMenuItem>
          </SidebarMenu>
          <p className="caption text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            g-lab
          </p>
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
