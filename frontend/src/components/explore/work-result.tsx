import { Link } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatDoi, type OpenAlexWork } from '#/lib/openalex.ts'

export function WorkResult({ work }: { work: OpenAlexWork }) {
  const authors = work.authors.slice(0, 3).join(', ')
  const extraAuthors =
    work.authors.length > 3 ? ` +${work.authors.length - 3}` : ''
  const year = work.publication_year?.toString() ?? '—'
  const tags = (work.tags ?? []).slice(0, 20)

  return (
    <article className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-4 px-4 py-5 sm:grid-cols-[4rem_minmax(0,1fr)] sm:px-6">
      <time
        className="font-serif text-lg tabular-nums leading-none tracking-tight text-muted-foreground"
        dateTime={
          work.publication_year ? String(work.publication_year) : undefined
        }
      >
        {year}
      </time>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-serif text-lg tracking-tight text-foreground sm:text-xl">
            <Link
              to="/dashboard/explore/$workId"
              params={{ workId: work.id }}
              search={(prev) => prev}
              className="underline-offset-4 hover:underline"
            >
              {work.display_name}
            </Link>
          </h2>
          {work.is_oa ? <Badge variant="secondary">Open access</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {authors || 'Unknown authors'}
          {extraAuthors}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs tracking-wide text-muted-foreground">
          <span>{work.venue || 'Venue not listed'}</span>
          <Separator className="h-3" orientation="vertical" />
          <span className="font-mono">
            {work.cited_by_count.toLocaleString()} cited
          </span>
          {work.doi ? (
            <>
              <Separator className="h-3" orientation="vertical" />
              <a
                className="font-mono underline-offset-4 hover:text-foreground hover:underline"
                href={work.doi}
                rel="noreferrer"
                target="_blank"
              >
                {formatDoi(work.doi)}
              </a>
            </>
          ) : null}
        </div>
        {tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  )
}
