import { useState } from 'react'
import { ChevronRight, ExternalLink, FileText } from 'lucide-react'

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
import type { MessageCitations } from '#/lib/sessions.ts'

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function MessageCitationsList({
  citations,
}: {
  citations: MessageCitations
}) {
  const [open, setOpen] = useState(false)
  const count = citations.paper.length + citations.web.length

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
            className={cn('transition-transform', open && 'rotate-90')}
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
