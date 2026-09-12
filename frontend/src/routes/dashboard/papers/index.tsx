import { PapersLibrary } from '#/components/papers/papers-library.tsx'
import { papersSearchSchema } from '#/lib/papers.ts'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/papers/')({
  validateSearch: (search) => papersSearchSchema.parse(search),
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <PapersLibrary />
    </div>
  )
}
