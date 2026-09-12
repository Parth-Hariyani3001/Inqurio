import { Link } from '@tanstack/react-router'

import { SessionActions } from '#/components/chats/session-actions.tsx'
import { formatSessionDate, type SessionListItem } from '#/lib/sessions.ts'

export function ChatResult({ session }: { session: SessionListItem }) {
  return (
    <article className="flex flex-col gap-2 px-4 py-5 sm:px-6">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 font-serif text-lg tracking-tight text-foreground sm:text-xl">
          <Link
            to="/dashboard/chats/$sessionId"
            params={{ sessionId: session.uid }}
            className="underline-offset-4 hover:underline"
          >
            {session.title}
          </Link>
        </h2>
        <SessionActions sessionId={session.uid} title={session.title} />
      </div>
      <p className="text-sm text-muted-foreground">{session.paper_title}</p>
      <p className="font-mono text-xs tracking-wide text-muted-foreground">
        Started {formatSessionDate(session.created_at)}
      </p>
    </article>
  )
}
