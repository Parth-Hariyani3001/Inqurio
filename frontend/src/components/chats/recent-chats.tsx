import { MessageSquare } from 'lucide-react'
import { useAuth } from '@clerk/tanstack-react-start'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar'
import { recentSessionsQueryOptions } from '#/lib/sessions.ts'

export function RecentChats() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { isLoaded, getToken } = useAuth()
  const recentQuery = useQuery(recentSessionsQueryOptions(getToken, isLoaded))

  const sessions = recentQuery.data ?? []

  if (recentQuery.isError) {
    return null
  }

  if (!recentQuery.isPending && sessions.length === 0) {
    return null
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Recent</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {recentQuery.isPending
            ? Array.from({ length: 4 }, (_, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
              ))
            : sessions.map((session) => (
                <SidebarMenuItem key={session.uid}>
                  <SidebarMenuButton
                    isActive={pathname === `/dashboard/chats/${session.uid}`}
                    tooltip={session.title}
                    onPress={() =>
                      void navigate({
                        to: '/dashboard/chats/$sessionId',
                        params: { sessionId: session.uid },
                      })
                    }
                  >
                    <MessageSquare />
                    <span>{session.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
