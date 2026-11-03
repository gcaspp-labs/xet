import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import {
  BellRing,
  BookUser,
  Boxes,
  Building2,
  CircleAlert,
  Landmark,
  LogOut,
  MessagesSquare,
  Monitor,
  Moon,
  QrCode,
  Settings,
  Sun,
  Users,
  Volume2,
  type LucideIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { NotificationBell } from '@/components/NotificationBell'
import { RealtimeNote } from '@/components/RealtimeNote'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { type NotificationBlock, useAlertSettings } from '@/lib/alerts'
import { type Role, type User, useCurrentUser, useLogout } from '@/lib/auth'
import { roleLabels } from '@/lib/format'
import { useRealtime } from '@/lib/realtime'
import { type Theme, useTheme } from '@/lib/theme'

type NavItem = { to: string; label: string; icon: LucideIcon; roles: Role[] }

// A interface só reflete as permissões; o backend recusa o acesso de quem não pode.
const helpdeskItems: NavItem[] = [
  { to: '/', label: 'Atendimento', icon: MessagesSquare, roles: ['agent', 'supervisor', 'admin'] },
  { to: '/contatos', label: 'Contatos', icon: BookUser, roles: ['agent', 'supervisor', 'admin'] },
  { to: '/conexao', label: 'Conexão', icon: QrCode, roles: ['supervisor', 'admin'] },
]

// Cadastro único de clientes: todos consultam; o backend restringe a edição de órgãos.
const registryItems: NavItem[] = [
  { to: '/orgaos', label: 'Órgãos', icon: Landmark, roles: ['agent', 'supervisor', 'admin'] },
  { to: '/modulos', label: 'Módulos', icon: Boxes, roles: ['supervisor', 'admin'] },
  { to: '/admin/setores', label: 'Setores', icon: Building2, roles: ['admin'] },
]

function NavGroup({ label, items, role }: { label: string; items: NavItem[]; role: Role }) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  const visible = items.filter((item) => item.roles.includes(role))
  if (visible.length === 0) {
    return null
  }
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="overline whitespace-nowrap text-sidebar-foreground/70 group-data-[collapsible=icon]:mt-0">
        {label}
      </SidebarGroupLabel>
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

const notificationBlockReasons: Record<NotificationBlock, string> = {
  denied: 'Notificações bloqueadas neste navegador. Libere nas permissões do site.',
  insecure: 'Notificações exigem endereço seguro. Acesse o sistema por HTTPS.',
  unsupported: 'Este navegador não oferece notificações. Use outro navegador.',
}

function AlertSettings() {
  const { browser, sound, block, setBrowserAlerts, setSoundAlerts } = useAlertSettings()
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Alertas</DropdownMenuLabel>
      <DropdownMenuCheckboxItem
        checked={browser}
        disabled={block !== undefined}
        onCheckedChange={(checked) => void setBrowserAlerts(checked)}
      >
        <BellRing strokeWidth={1.7} aria-hidden />
        Notificação do navegador
      </DropdownMenuCheckboxItem>
      {block && (
        <Alert variant="warning" className="my-1">
          <CircleAlert strokeWidth={1.7} aria-hidden />
          <AlertDescription>{notificationBlockReasons[block]}</AlertDescription>
        </Alert>
      )}
      <DropdownMenuCheckboxItem checked={sound} onCheckedChange={setSoundAlerts}>
        <Volume2 strokeWidth={1.7} aria-hidden />
        Som
      </DropdownMenuCheckboxItem>
    </DropdownMenuGroup>
  )
}

function SettingsMenu({ role }: { role: Role }) {
  const [theme, setTheme] = useTheme()
  const logout = useLogout()
  const navigate = useNavigate()
  const { setOpenMobile } = useSidebar()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<SidebarMenuButton />}>
        <Settings strokeWidth={1.7} className="size-[15px]!" aria-hidden />
        <span>Configurações</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="min-w-60">
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
        <AlertSettings />
        <DropdownMenuSeparator />
        {role === 'admin' && (
          <DropdownMenuItem
            onClick={() => {
              setOpenMobile(false)
              navigate('/admin/usuarios')
            }}
          >
            <Users strokeWidth={1.7} aria-hidden />
            Usuários
          </DropdownMenuItem>
        )}
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

// Cabeçalho fixo: a marca e as notificações não mudam de lugar ao recolher a barra lateral.
function AppHeader({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2.5 border-b border-line bg-card px-2 md:px-4">
      <SidebarTrigger className="md:hidden" />
      <img src={symbol} alt="" className="size-8 shrink-0 dark:hidden" />
      <img src={symbolDark} alt="" className="hidden size-8 shrink-0 dark:block" />
      <div className="min-w-0 flex-1">
        <p className="body-strong truncate">GCASPP LAB</p>
        <p className="caption truncate text-ink-soft">Central de Atendimento</p>
      </div>
      <NotificationBell user={user} />
    </header>
  )
}

export default function AppLayout() {
  const { data: user } = useCurrentUser()
  const online = useRealtime()
  if (!user) {
    return null
  }

  return (
    <SidebarProvider
      defaultOpen={!document.cookie.includes('sidebar_state=false')}
      className="flex-col"
      style={{ '--header-height': '3.5rem' } as CSSProperties}
    >
      <AppHeader user={user} />
      <div className="flex flex-1">
        <Sidebar
          collapsible="icon"
          className="top-(--header-height) h-[calc(100svh-var(--header-height))]"
        >
          <SidebarHeader className="hidden items-end group-data-[collapsible=icon]:items-center md:flex">
            <SidebarTrigger />
          </SidebarHeader>
          <SidebarContent>
            <NavGroup label="Helpdesk" items={helpdeskItems} role={user.role} />
            <NavGroup label="Cadastro" items={registryItems} role={user.role} />
          </SidebarContent>
          <SidebarFooter className="gap-3 border-t border-sidebar-border px-2 py-3">
            <div className="min-w-0 px-2 whitespace-nowrap transition-[opacity,visibility] duration-200 group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:opacity-0">
              <p className="body-strong truncate text-sidebar-text-active">{user.name}</p>
              <p className="caption truncate">{roleLabels[user.role]}</p>
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SettingsMenu role={user.role} />
              </SidebarMenuItem>
            </SidebarMenu>
            <p className="caption px-2 whitespace-nowrap text-sidebar-foreground/60 transition-[opacity,visibility] duration-200 group-data-[collapsible=icon]:invisible group-data-[collapsible=icon]:opacity-0">
              g-lab
            </p>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          {!online && <RealtimeNote />}
          <Outlet />
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
