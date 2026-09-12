import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'

import { AppSidebar } from '#/components/app-sidebar.tsx'
import { ModeToggle } from '#/components/mode-toggle.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '#/components/ui/sidebar.tsx'
import { requireAuth } from '#/lib/auth.ts'
import { meQueryOptions } from '#/lib/me.ts'
import { sessionDetailQueryOptions } from '#/lib/sessions.ts'

export const Route = createFileRoute('/dashboard')({
  component: RouteComponent,
  beforeLoad: async ({ context }) => {
    const session = await requireAuth()
    await context.queryClient.ensureQueryData(meQueryOptions())
    return session
  },
})

function dashboardTitle(
  pathname: string,
  search: unknown,
  sessionTitle?: string,
) {
  const sessionMatch = pathname.match(/^\/dashboard\/chats\/([^/]+)\/?$/)
  if (sessionMatch?.[1]) {
    return sessionTitle || 'Chats'
  }
  if (pathname.startsWith('/dashboard/chats')) {
    return 'Chats'
  }

  const fromPapers =
    typeof search === 'object' &&
    search !== null &&
    'src' in search &&
    search.src === 'papers'
  const fromLibrary =
    typeof search === 'object' &&
    search !== null &&
    'src' in search &&
    search.src === 'library'

  if (pathname.startsWith('/dashboard/library') || fromLibrary) {
    return 'Library'
  }
  if (pathname.startsWith('/dashboard/papers') || fromPapers) {
    return 'Papers'
  }
  if (pathname.startsWith('/dashboard/explore')) {
    return 'Explore'
  }
  return 'Dashboard'
}

function RouteComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = useRouterState({ select: (s) => s.location.search })
  const sessionId = pathname.match(/^\/dashboard\/chats\/([^/]+)\/?$/)?.[1]
  const sessionQuery = useQuery({
    ...sessionDetailQueryOptions(sessionId ?? ''),
    enabled: Boolean(sessionId),
  })
  const title = dashboardTitle(pathname, search, sessionQuery.data?.title)

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-full" />
          <h1 className="truncate font-serif text-sm tracking-tight">{title}</h1>
          <div className="ml-auto">
            <ModeToggle />
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
