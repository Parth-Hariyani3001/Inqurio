import type { ComponentProps } from 'react'
import { BookMarked, Compass, Library, MessageSquare } from 'lucide-react'
import { useNavigate, useRouterState } from '@tanstack/react-router'

import { InquiroMark } from '#/components/inquiro-mark.tsx'
import { RecentChats } from '#/components/chats/recent-chats.tsx'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { toPapersSearch } from '#/lib/papers.ts'
import { toLibrarySearch } from '#/lib/user-papers.ts'

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = useRouterState({ select: (s) => s.location.search })
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
  const exploreActive =
    pathname.startsWith('/dashboard/explore') && !fromPapers && !fromLibrary
  const libraryActive = pathname.startsWith('/dashboard/library') || fromLibrary
  const papersActive = pathname.startsWith('/dashboard/papers') || fromPapers
  const chatsActive = pathname.startsWith('/dashboard/chats')

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Inquiro"
              onPress={() => navigate({ to: '/' })}
            >
              <InquiroMark className="text-sidebar-primary" />
              <span className="font-display">Inquiro</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={exploreActive}
                  tooltip="Explore"
                  onPress={() => {
                    if (
                      fromPapers ||
                      fromLibrary ||
                      pathname.startsWith('/dashboard/papers') ||
                      pathname.startsWith('/dashboard/library')
                    ) {
                      void navigate({ to: '/dashboard/explore', search: {} })
                      return
                    }

                    void navigate({
                      to: '/dashboard/explore',
                      search: (prev) => {
                        const { src: _src, offset: _offset, ...rest } = prev
                        return rest
                      },
                    })
                  }}
                >
                  <Compass />
                  <span>Explore</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={libraryActive}
                  tooltip="Library"
                  onPress={() =>
                    navigate({
                      to: '/dashboard/library',
                      search: (prev) =>
                        prev.src === 'library'
                          ? toLibrarySearch(prev.q ?? '', prev.offset)
                          : {},
                    })
                  }
                >
                  <Library />
                  <span>Library</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={papersActive}
                  tooltip="Papers"
                  onPress={() =>
                    navigate({
                      to: '/dashboard/papers',
                      search: (prev) =>
                        prev.src === 'papers'
                          ? toPapersSearch(prev.q ?? '', prev.offset)
                          : {},
                    })
                  }
                >
                  <BookMarked />
                  <span>Papers</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={chatsActive}
                  tooltip="Chats"
                  onPress={() =>
                    navigate({
                      to: '/dashboard/chats',
                    })
                  }
                >
                  <MessageSquare />
                  <span>Chats</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <RecentChats />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
