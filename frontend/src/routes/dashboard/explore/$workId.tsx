import { FileQuestion } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import {
  Link,
  createFileRoute,
  isNotFound,
  notFound,
  useRouter,
} from '@tanstack/react-router'

import { WorkDetail, WorkDetailSkeleton } from '#/components/explore/work-detail.tsx'
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
import { workDetailQueryOptions } from '#/lib/openalex.ts'
import { toPapersSearch } from '#/lib/papers.ts'
import { toLibrarySearch } from '#/lib/user-papers.ts'

export const Route = createFileRoute('/dashboard/explore/$workId')({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(
        workDetailQueryOptions(params.workId),
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
  pendingComponent: WorkDetailPending,
  pendingMs: 400,
  errorComponent: WorkDetailError,
  notFoundComponent: WorkDetailNotFound,
  component: RouteComponent,
})

function RouteComponent() {
  const { workId } = Route.useParams()
  const workQuery = useQuery(workDetailQueryOptions(workId))

  if (!workQuery.data) {
    return <WorkDetailSkeleton />
  }

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <WorkDetail work={workQuery.data} />
    </div>
  )
}

function WorkDetailPending() {
  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <WorkDetailSkeleton />
    </div>
  )
}

function WorkDetailError({ error }: { error: Error }) {
  const router = useRouter()

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <Empty className="flex-1 border border-dashed">
        <EmptyHeader>
          <EmptyTitle>Could not load this work</EmptyTitle>
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

function WorkDetailNotFound() {
  const { workId } = Route.useParams()
  const search = Route.useSearch()
  const fromPapers = search.src === 'papers'
  const fromLibrary = search.src === 'library'

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <Empty className="flex-1 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestion />
          </EmptyMedia>
          <EmptyTitle>Work not found</EmptyTitle>
          <EmptyDescription>
            {fromPapers
              ? `OpenAlex has no work ${workId}. Return to Papers and pick another record.`
              : fromLibrary
                ? `OpenAlex has no work ${workId}. Return to Library and pick another record.`
                : `OpenAlex has no work ${workId}. Return to Explore and pick another result.`}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {fromPapers ? (
            <Link
              to="/dashboard/papers"
              search={toPapersSearch(search.q ?? '', search.offset)}
              className="text-sm underline-offset-4 hover:underline"
            >
              Back to Papers
            </Link>
          ) : fromLibrary ? (
            <Link
              to="/dashboard/library"
              search={toLibrarySearch(search.q ?? '', search.offset)}
              className="text-sm underline-offset-4 hover:underline"
            >
              Back to Library
            </Link>
          ) : (
            <Link
              to="/dashboard/explore"
              search={(prev) => {
                const { src: _src, offset: _offset, ...rest } = prev
                return rest
              }}
              className="text-sm underline-offset-4 hover:underline"
            >
              Back to Explore
            </Link>
          )}
        </EmptyContent>
      </Empty>
    </div>
  )
}
