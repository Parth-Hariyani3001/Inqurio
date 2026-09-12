import { FileQuestion } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  isNotFound,
  notFound,
  useRouter,
} from '@tanstack/react-router'

import {
  ChatWorkspace,
  ChatWorkspaceSkeleton,
} from '#/components/chats/chat-workspace.tsx'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ApiError } from '#/lib/api.ts'
import { sessionDetailQueryOptions } from '#/lib/sessions.ts'

export const Route = createFileRoute('/dashboard/chats/$sessionId')({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(
        sessionDetailQueryOptions(params.sessionId),
      )
    } catch (error) {
      if (isNotFound(error)) {
        throw error
      }
      if (error instanceof ApiError && error.status === 404) {
        throw notFound()
      }
      throw error
    }
  },
  pendingComponent: ChatSessionPending,
  pendingMs: 400,
  errorComponent: ChatSessionError,
  notFoundComponent: ChatSessionNotFound,
  component: RouteComponent,
})

function RouteComponent() {
  const { sessionId } = Route.useParams()
  const sessionQuery = useQuery(sessionDetailQueryOptions(sessionId))

  if (!sessionQuery.data) {
    return <ChatWorkspaceSkeleton />
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ChatWorkspace session={sessionQuery.data} />
    </div>
  )
}

function ChatSessionPending() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ChatWorkspaceSkeleton />
    </div>
  )
}

function ChatSessionError({ error }: { error: Error }) {
  const router = useRouter()

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <Empty className="flex-1 border border-dashed">
        <EmptyHeader>
          <EmptyTitle>Could not load this chat</EmptyTitle>
          <EmptyDescription>
            {error.message || 'The request failed. Try again.'}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type="button" onPress={() => router.invalidate()}>
            Try again
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}

function ChatSessionNotFound() {
  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <Empty className="flex-1 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestion />
          </EmptyMedia>
          <EmptyTitle>Chat not found</EmptyTitle>
          <EmptyDescription>
            This session is missing or you do not have access. Return to Chats
            and pick another thread.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link
            to="/dashboard/chats"
            className="text-sm underline-offset-4 hover:underline"
          >
            Back to Chats
          </Link>
        </EmptyContent>
      </Empty>
    </div>
  )
}
