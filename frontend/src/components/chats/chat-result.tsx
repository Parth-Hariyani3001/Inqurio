import { Link } from '@tanstack/react-router'

import { formatSessionDate, type SessionListItem } from '#/lib/sessions.ts'

export function ChatResult({ session }: { session: SessionListItem }) {
  return (
    <article className="flex flex-col gap-2 px-4 py-5 sm:px-6">
      <h2 className="font-serif text-lg tracking-tight text-foreground sm:text-xl">
        <Link
          to="/dashboard/chats/$sessionId"
          params={{ sessionId: session.uid }}
          className="underline-offset-4 hover:underline"
        >
          {session.title}
        </Link>
      </h2>
      <p className="text-sm text-muted-foreground">{session.paper_title}</p>
      <p className="font-mono text-xs tracking-wide text-muted-foreground">
        Started {formatSessionDate(session.created_at)}
      </p>
    </article>
  )
}
