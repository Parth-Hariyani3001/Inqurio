import { OpenAlexSearch } from '#/components/explore/openalex-search.tsx'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/explore/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <OpenAlexSearch />
    </div>
  )
}
