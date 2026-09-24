import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BookOpen, ChevronRight, ExternalLink, FileText } from 'lucide-react'

import {
  Attachment,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from '@/components/ui/attachment'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { cn } from '@/lib/utils'
import { toOpenAlexWorkId } from '#/lib/papers.ts'
import type { MessageCitations, OpenAlexCitation } from '#/lib/sessions.ts'

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function openAlexSnippet(item: OpenAlexCitation) {
  const authors = item.authors.slice(0, 3).join(', ')
  const extras =
    item.authors.length > 3 ? ` +${item.authors.length - 3}` : ''
  const parts: Array<string> = []
  if (authors) parts.push(`${authors}${extras}`)
  if (item.publication_year) parts.push(String(item.publication_year))
  if (item.venue) parts.push(item.venue)
  if (item.cited_by_count > 0) {
    parts.push(`${item.cited_by_count} citations`)
  }
  return parts.join(' · ')
}

export function MessageCitationsList({
  citations,
}: {
  citations: MessageCitations
}) {
  const [open, setOpen] = useState(false)
  const count =
    citations.paper.length + citations.web.length + citations.openalex.length

  return (
    <div className="flex flex-col gap-2">
      <Marker
        render={(props) => (
          <button
            {...props}
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          />
        )}
      >
        <MarkerIcon>
          <ChevronRight
            className={cn(
              'transition-transform duration-200 ease-out',
              open && 'rotate-90',
            )}
          />
        </MarkerIcon>
        <MarkerContent>Sources ({count})</MarkerContent>
      </Marker>

      {open ? (
        <>
          {citations.paper.length > 0 ? (
            <div className="flex flex-col gap-2">
              {citations.paper.map((item) => (
                <Attachment
                  key={item.chunk_id}
                  className="w-full"
                  size="sm"
                  state="done"
                >
                  <AttachmentMedia>
                    <FileText />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>
                      {item.section || 'Paper passage'}
                    </AttachmentTitle>
                    {item.excerpt ? (
                      <AttachmentDescription className="line-clamp-3 whitespace-normal">
                        {item.excerpt}
                      </AttachmentDescription>
                    ) : null}
                  </AttachmentContent>
                </Attachment>
              ))}
            </div>
          ) : null}

          {citations.openalex.length > 0 ? (
            <div className="flex flex-col gap-2">
              {citations.openalex.map((item) => {
                const workId = toOpenAlexWorkId(item.id)
                const snippet = openAlexSnippet(item)
                return (
                  <Attachment
                    key={item.id}
                    className="w-full"
                    size="sm"
                    state="done"
                  >
                    <AttachmentMedia>
                      <BookOpen />
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>{item.display_name}</AttachmentTitle>
                      {snippet ? (
                        <AttachmentDescription className="line-clamp-2 whitespace-normal">
                          {snippet}
                        </AttachmentDescription>
                      ) : null}
                    </AttachmentContent>
                    <AttachmentTrigger
                      aria-label={`Open ${item.display_name}`}
                      render={(props) => (
                        <Link
                          {...props}
                          to="/dashboard/explore/$workId"
                          params={{ workId }}
                          search={(prev) => prev}
                        />
                      )}
                    />
                  </Attachment>
                )
              })}
            </div>
          ) : null}

          {citations.web.length > 0 ? (
            <div className="flex flex-col gap-2">
              {citations.web.map((item) => (
                <Attachment
                  key={item.url}
                  className="w-full"
                  size="sm"
                  state="done"
                >
                  <AttachmentMedia>
                    <ExternalLink />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{item.title}</AttachmentTitle>
                    {item.snippet ? (
                      <AttachmentDescription className="line-clamp-2 whitespace-normal">
                        {hostname(item.url)} · {item.snippet}
                      </AttachmentDescription>
                    ) : (
                      <AttachmentDescription>
                        {hostname(item.url)}
                      </AttachmentDescription>
                    )}
                  </AttachmentContent>
                  <AttachmentTrigger
                    aria-label={`Open ${item.title}`}
                    render={(props) => (
                      <a
                        {...props}
                        href={item.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      />
                    )}
                  />
                </Attachment>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
