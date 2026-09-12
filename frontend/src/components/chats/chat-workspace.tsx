import { FileText, MessageSquare } from 'lucide-react'

import { PdfFolio } from '#/components/chats/pdf-folio.tsx'
import { SessionChat } from '#/components/chats/session-chat.tsx'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { SessionDetailResponse } from '#/lib/sessions.ts'

export function ChatWorkspace({ session }: { session: SessionDetailResponse }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <Tabs
          className="flex min-h-0 flex-1 gap-0"
          defaultSelectedKey="paper"
        >
          <div className="shrink-0 border-b border-border px-3 py-2">
            <TabsList className="w-full">
              <TabsTrigger id="paper">
                <FileText data-icon="inline-start" />
                Paper
              </TabsTrigger>
              <TabsTrigger id="chat">
                <MessageSquare data-icon="inline-start" />
                Chat
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent className="flex min-h-0 flex-1 flex-col" id="paper">
            <PdfFolio paperId={session.paper_id} />
          </TabsContent>
          <TabsContent className="flex min-h-0 flex-1 flex-col" id="chat">
            <SessionChat messages={session.messages} />
          </TabsContent>
        </Tabs>
      </div>
      <div className="hidden min-h-0 flex-1 md:flex">
        <ResizablePanelGroup className="h-full min-h-0" orientation="horizontal">
          <ResizablePanel className="min-h-0" defaultSize="58%" minSize="30%">
            <PdfFolio paperId={session.paper_id} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel className="min-h-0" defaultSize="42%" minSize="24%">
            <SessionChat messages={session.messages} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

export function ChatWorkspaceSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 gap-0">
      <Skeleton className="hidden flex-1 md:block" />
      <Skeleton className="flex-1" />
    </div>
  )
}
