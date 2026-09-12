import { ChatsLibrary } from '#/components/chats/chats-library.tsx'
import { sessionsSearchSchema } from '#/lib/sessions.ts'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/chats/')({
  validateSearch: (search) => sessionsSearchSchema.parse(search),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <ChatsLibrary />
    </div>
  )
}
