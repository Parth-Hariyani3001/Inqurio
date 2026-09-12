import { UserLibrary } from '#/components/library/user-library.tsx'
import { librarySearchSchema } from '#/lib/user-papers.ts'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/library/')({
  validateSearch: (search) => librarySearchSchema.parse(search),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <UserLibrary />
    </div>
  )
}
