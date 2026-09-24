import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Link, getRouteApi } from '@tanstack/react-router'

import { AddToListButton } from '#/components/explore/add-to-list-button.tsx'
import { StartChatButton } from '#/components/chats/start-chat-button.tsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  formatDoi,
  type ExploreSearch,
  type IngestStatus,
  type OpenAlexWorkDetail,
} from '#/lib/openalex.ts'
import { toPapersSearch } from '#/lib/papers.ts'
import { toLibrarySearch } from '#/lib/user-papers.ts'

const exploreRoute = getRouteApi('/dashboard/explore')

function exploreResultsSearch(search: ExploreSearch): ExploreSearch {
  const { src: _src, offset: _offset, ...rest } = search
  return rest
}

function ingestLabel(status: IngestStatus) {
  if (status === 'ready') return 'Parsed'
  if (status === 'processing') return 'Parsing'
  if (status === 'pending') return 'Parsing queued'
  return 'Parse failed'
}

export function WorkDetail({ work }: { work: OpenAlexWorkDetail }) {
  const search = exploreRoute.useSearch()
  const fromPapers = search.src === 'papers'
  const fromLibrary = search.src === 'library'
  const authors = work.authors.join(', ') || 'Unknown authors'
  const year = work.publication_year?.toString() ?? '—'
  const canAdd = work.ingest_status !== 'failed'

  return (
    <article className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      {fromPapers ? (
        <Link
          to="/dashboard/papers"
          search={toPapersSearch(search.q ?? '', search.offset)}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft />
          Back to papers
        </Link>
      ) : fromLibrary ? (
        <Link
          to="/dashboard/library"
          search={toLibrarySearch(search.q ?? '', search.offset)}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft />
          Back to library
        </Link>
      ) : (
        <Link
          to="/dashboard/explore"
          search={exploreResultsSearch}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft />
          Back to results
        </Link>
      )}

      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl tracking-tight text-foreground sm:text-3xl">
            {work.display_name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{authors}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{year}</span>
            <Separator className="h-3" orientation="vertical" />
            <span>{work.venue || 'Venue not listed'}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <div className="flex flex-wrap gap-1.5">
            {work.is_oa ? <Badge variant="secondary">Open access</Badge> : null}
            {work.in_database && work.ingest_status ? (
              <Badge
                variant={work.ingest_status === 'failed' ? 'destructive' : 'outline'}
              >
                {ingestLabel(work.ingest_status)}
              </Badge>
            ) : null}
          </div>
          {canAdd ? (
            <div className="flex flex-wrap gap-2">
              <AddToListButton
                workId={work.id}
                ingestStatus={work.ingest_status}
              />
              {work.paper_id ? (
                <StartChatButton
                  paperId={work.paper_id}
                  ingestStatus={work.ingest_status}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {work.is_retracted ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>This work is marked retracted</AlertTitle>
          <AlertDescription>
            OpenAlex lists this paper as retracted. Treat the record as
            withdrawn.
          </AlertDescription>
        </Alert>
      ) : null}

      {work.ingest_status === 'failed' ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>This paper cannot be added</AlertTitle>
          <AlertDescription>
            Parsing failed, so it cannot go on your list from here.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section>
          <p className="text-muted-foreground text-xs">Abstract</p>
          {work.abstract ? (
            <p className="mt-3 font-serif text-base leading-[1.7] text-foreground/90 sm:text-[1.05rem]">
              {work.abstract}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No abstract is available for this work.
            </p>
          )}
        </section>

        <aside className="flex flex-col gap-4 border-t border-border pt-4 text-sm lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
          <Fact label="Cited" value={work.cited_by_count.toLocaleString()} />
          {work.type ? <Fact label="Type" value={work.type} /> : null}
          {work.language ? <Fact label="Language" value={work.language} /> : null}
          {work.doi ? (
            <div>
              <p className="text-muted-foreground text-xs">DOI</p>
              <a
                className="mt-1 block font-mono text-xs underline-offset-4 hover:text-foreground hover:underline"
                href={work.doi}
                rel="noreferrer"
                target="_blank"
              >
                {formatDoi(work.doi)}
              </a>
            </div>
          ) : null}
          {work.oa_url ? (
            <div>
              <p className="text-muted-foreground text-xs">
                Open copy
              </p>
              <a
                className="mt-1 block underline-offset-4 hover:text-foreground hover:underline"
                href={work.oa_url}
                rel="noreferrer"
                target="_blank"
              >
                Open PDF or landing page
              </a>
            </div>
          ) : null}
          {work.topics.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-xs">Topics</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {work.topics.map((topic) => (
                  <Badge key={topic} variant="outline">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {work.institutions.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-xs">
                Institutions
              </p>
              <p className="mt-1 text-muted-foreground">
                {work.institutions.join(', ')}
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </article>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-mono text-xs">{value}</p>
    </div>
  )
}

export function WorkDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <Skeleton className="h-4 w-32" />
      <div className="flex flex-col gap-4 border-b border-border pb-6">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </div>
    </div>
  )
}
