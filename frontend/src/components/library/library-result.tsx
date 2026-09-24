import { Link, getRouteApi } from '@tanstack/react-router'

import { StartChatButton } from '#/components/chats/start-chat-button.tsx'
import { Badge } from '@/components/ui/badge'
import { formatDoi } from '#/lib/openalex.ts'
import { ingestStatusLabel, toOpenAlexWorkId } from '#/lib/papers.ts'
import { formatAddedAt, type UserPaperResponse } from '#/lib/user-papers.ts'

const libraryRoute = getRouteApi('/dashboard/library/')

export function LibraryResult({ paper }: { paper: UserPaperResponse }) {
  const librarySearch = libraryRoute.useSearch()
  const authors = paper.authors.slice(0, 3).join(', ')
  const extraAuthors =
    paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : ''

  return (
    <article className="flex flex-col gap-2 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-serif text-lg tracking-tight text-foreground sm:text-xl">
          <Link
            to="/dashboard/explore/$workId"
            params={{ workId: toOpenAlexWorkId(paper.openalex_id) }}
            search={{
              src: 'library',
              q: librarySearch.q,
              offset: librarySearch.offset,
            }}
            className="underline-offset-4 hover:underline"
          >
            {paper.title}
          </Link>
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant={paper.status === 'failed' ? 'destructive' : 'outline'}
          >
            {ingestStatusLabel(paper.status)}
          </Badge>
          <StartChatButton paperId={paper.uid} ingestStatus={paper.status} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {authors || 'Unknown authors'}
        {extraAuthors}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Added {formatAddedAt(paper.added_at)}</span>
        {paper.doi ? (
          <a
            className="font-mono underline-offset-4 hover:text-foreground hover:underline"
            href={
              paper.doi.startsWith('http')
                ? paper.doi
                : `https://doi.org/${paper.doi}`
            }
            rel="noreferrer"
            target="_blank"
          >
            {formatDoi(paper.doi)}
          </a>
        ) : null}
      </div>
      {paper.custom_tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {paper.custom_tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
      {paper.abstract ? (
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {paper.abstract}
        </p>
      ) : null}
    </article>
  )
}
