import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/tanstack-react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookmarkPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ApiError } from '#/lib/api.ts'
import { workDetailQueryOptions } from '#/lib/openalex.ts'
import type { IngestStatus } from '#/lib/openalex.ts'
import { uploadPaper } from '#/lib/papers.ts'

export function AddToListButton({
  workId,
  ingestStatus,
}: {
  workId: string
  ingestStatus: IngestStatus | null
}) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const [onList, setOnList] = useState(false)
  const [waitingForParse, setWaitingForParse] = useState(false)

  const workQuery = useQuery({
    ...workDetailQueryOptions(workId),
    refetchInterval: waitingForParse ? 5_000 : false,
  })

  const status = workQuery.data?.ingest_status ?? ingestStatus

  useEffect(() => {
    if (!waitingForParse) return

    if (status === 'ready') {
      setWaitingForParse(false)
      setOnList(true)
      toast.success('Added to your list.')
    }

    if (status === 'failed') {
      setWaitingForParse(false)
      toast.error('This paper could not be parsed.')
    }
  }, [status, waitingForParse])

  const addMutation = useMutation({
    mutationFn: () => uploadPaper(workId, getToken),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ['openalex', 'work', workId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['papers'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['user-papers'],
      })

      if (result.ready) {
        setOnList(true)
        toast.success('Added to your list.')
        return
      }

      setWaitingForParse(true)
      toast('Adding after parse.')
    },
    onError: (error) => {
      if (
        error instanceof ApiError &&
        error.code === 'user_paper_already_assigned'
      ) {
        setOnList(true)
        toast('This paper is already on your list.')
        return
      }

      if (error instanceof ApiError && error.code === 'paper_not_ready') {
        toast.error('This paper cannot be added.')
        return
      }

      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not add this paper to your list.',
      )
    },
  })

  if (onList) {
    return (
      <Button isDisabled type="button" variant="secondary">
        On your list
      </Button>
    )
  }

  const isBusy = addMutation.isPending || waitingForParse

  return (
    <Button
      isDisabled={isBusy}
      type="button"
      onPress={() => addMutation.mutate()}
    >
      {isBusy ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <BookmarkPlus data-icon="inline-start" />
      )}
      {waitingForParse ? 'Adding after parse' : 'Add to my list'}
    </Button>
  )
}
