import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { WorkResult } from '#/components/explore/work-result.tsx'
import type { OpenAlexWork } from '#/lib/openalex.ts'

export function WorksCatalog({
  query,
  results,
  rangeStart,
  rangeEnd,
  totalCount,
  hasPrev,
  hasNext,
  isFetching,
  onPrev,
  onNext,
}: {
  query: string
  results: Array<OpenAlexWork>
  rangeStart: number
  rangeEnd: number
  totalCount?: number
  hasPrev: boolean
  hasNext: boolean
  isFetching: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <section aria-busy={isFetching} className="flex flex-1 flex-col gap-4">
      <CatalogPager
        query={query}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        totalCount={totalCount}
        hasPrev={hasPrev}
        hasNext={hasNext}
        isFetching={isFetching}
        onPrev={onPrev}
        onNext={onNext}
      />
      <div className="border border-border bg-card text-card-foreground">
        {results.map((work, offset) => (
          <div key={work.id}>
            {offset > 0 ? <Separator /> : null}
            <WorkResult work={work} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function WorksCatalogSkeleton() {
  return (
    <section className="flex flex-1 flex-col gap-4">
      <Skeleton className="h-4 w-48" />
      <div className="border border-border bg-card">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index}>
            {index > 0 ? <Separator /> : null}
            <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 px-4 py-5 sm:px-6">
              <Skeleton className="h-6 w-10" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function CatalogPager({
  query,
  rangeStart,
  rangeEnd,
  totalCount,
  hasPrev,
  hasNext,
  isFetching,
  onPrev,
  onNext,
}: {
  query: string
  rangeStart: number
  rangeEnd: number
  totalCount?: number
  hasPrev: boolean
  hasNext: boolean
  isFetching: boolean
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs tracking-wide">
          Works matching
        </p>
        <p className="truncate font-serif text-lg tracking-tight text-foreground">
          {query}
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {rangeStart > 0 ? (
            <>
              {rangeStart}–{rangeEnd} of {totalCount?.toLocaleString() ?? '—'}
            </>
          ) : (
            'No results on this page'
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
  )
}
