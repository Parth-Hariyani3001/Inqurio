import { MessageSquare } from 'lucide-react'
import { useAuth } from '@clerk/tanstack-react-start'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { IngestStatus } from '#/lib/openalex.ts'
import { createSession } from '#/lib/sessions.ts'

export function StartChatButton({
  paperId,
  ingestStatus,
}: {
  paperId: string
  ingestStatus: IngestStatus | null
}) {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const startMutation = useMutation({
    mutationFn: () => createSession(paperId, getToken),
    onSuccess: async (session) => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('Chat started.')
      void navigate({
        to: '/dashboard/chats/$sessionId',
        params: { sessionId: session.uid },
      })
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not start a chat.',
      )
    },
  })

  if (ingestStatus !== 'ready') {
    return null
  }

  return (
    <Button
      isDisabled={startMutation.isPending}
      type="button"
      variant="outline"
      size="sm"
      onPress={() => startMutation.mutate()}
    >
      {startMutation.isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <MessageSquare data-icon="inline-start" />
      )}
      Start chat
    </Button>
  )
}
