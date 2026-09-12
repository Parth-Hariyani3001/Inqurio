import { useState } from 'react'
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
  const [pdfVisible, setPdfVisible] = useState(true)
  const [mobileTab, setMobileTab] = useState<'paper' | 'chat'>('paper')

  function showPdf() {
    setPdfVisible(true)
    setMobileTab('paper')
  }

  function hidePdf() {
    setPdfVisible(false)
    setMobileTab('chat')
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
        <Tabs
          className="flex min-h-0 flex-1 gap-0 overflow-hidden"
          selectedKey={mobileTab}
          onSelectionChange={(key) => {
            if (typeof key !== 'string') return
            const nextTab = key as 'paper' | 'chat'
            if (nextTab === 'paper') setPdfVisible(true)
            setMobileTab(nextTab)
          }}
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
          <TabsContent
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            id="paper"
          >
            <PdfFolio
              paperId={session.paper_id}
              title={session.title}
              onHide={hidePdf}
            />
          </TabsContent>
          <TabsContent
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            id="chat"
          >
            <SessionChat
              messages={session.messages}
              onShowPdf={!pdfVisible ? showPdf : undefined}
            />
          </TabsContent>
        </Tabs>
      </div>
      <div className="hidden min-h-0 flex-1 overflow-hidden md:flex">
        <ResizablePanelGroup
          className="h-full min-h-0"
          orientation="horizontal"
        >
          {pdfVisible ? (
            <>
              <ResizablePanel
                className="min-h-0 overflow-hidden"
                defaultSize="58%"
                minSize="30%"
              >
                <PdfFolio
                  paperId={session.paper_id}
                  title={session.title}
                  onHide={hidePdf}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          ) : null}
          <ResizablePanel
            className="min-h-0 overflow-hidden"
            defaultSize={pdfVisible ? '42%' : '100%'}
            minSize={pdfVisible ? '24%' : '100%'}
          >
            <SessionChat
              messages={session.messages}
              onShowPdf={!pdfVisible ? showPdf : undefined}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

export function ChatWorkspaceSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-1 gap-0 overflow-hidden">
      <Skeleton className="hidden flex-1 md:block" />
      <Skeleton className="flex-1" />
    </div>
  )
}
