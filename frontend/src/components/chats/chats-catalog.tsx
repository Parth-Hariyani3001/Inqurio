import { ChevronLeft, ChevronRight } from 'lucide-react'

import { ChatResult } from '#/components/chats/chat-result.tsx'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import type { SessionListItem } from '#/lib/sessions.ts'

export function ChatsCatalog({
  results,
  rangeStart,
  rangeEnd,
  hasPrev,
  hasNext,
  isFetching,
  onPrev,
  onNext,
}: {
  results: Array<SessionListItem>
  rangeStart: number
  rangeEnd: number
  hasPrev: boolean
  hasNext: boolean
  isFetching: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <section aria-busy={isFetching} className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs tracking-wide">
            Your chats
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {rangeStart > 0 ? (
              <>
                {rangeStart}–{rangeEnd}
              </>
            ) : (
              'No chats on this page'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            type="button"
            variant="outline"
            isDisabled={!hasPrev || isFetching}
            onPress={onPrev}
          >
            {isFetching ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ChevronLeft data-icon="inline-start" />
            )}
            Previous
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            isDisabled={!hasNext || isFetching}
            onPress={onNext}
          >
            Next
            {isFetching ? (
              <Spinner data-icon="inline-end" />
            ) : (
              <ChevronRight data-icon="inline-end" />
            )}
          </Button>
        </div>
      </div>
      <div className="border border-border bg-card text-card-foreground">
        {results.map((session, offset) => (
          <div key={session.uid}>
            {offset > 0 ? <Separator /> : null}
            <ChatResult session={session} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function ChatsCatalogSkeleton() {
  return (
    <section className="flex flex-1 flex-col gap-4">
      <Skeleton className="h-4 w-48" />
      <div className="border border-border bg-card">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index}>
            {index > 0 ? <Separator /> : null}
            <div className="flex flex-col gap-2 px-4 py-5 sm:px-6">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
