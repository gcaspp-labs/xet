import type { ReactNode } from 'react'
import { SidebarTrigger } from '@/components/ui/sidebar'

// Topbar do design system: breadcrumb, título e no máximo uma ação primária.
export function Topbar({
  breadcrumb,
  title,
  action,
}: {
  breadcrumb?: string
  title: string
  action?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-line-soft bg-background">
      <div className="mx-auto flex max-w-(--content-max) flex-wrap items-center gap-3 px-4 py-3 md:px-[30px]">
        <SidebarTrigger className="md:hidden" />
        <div className="min-w-0 flex-1">
          {breadcrumb && <p className="caption text-ink-faint">{breadcrumb}</p>}
          <h1 className="title-page truncate">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  )
}

// Conteúdo da página: largura máxima content-max, padding space-30 no desktop e space-16 no celular.
export function PageContent({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-(--content-max) flex-col gap-4 px-4 py-4 md:px-[30px] md:py-[30px]">
      {children}
    </div>
  )
}
