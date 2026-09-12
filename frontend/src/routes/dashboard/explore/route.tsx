import { Outlet, createFileRoute } from '@tanstack/react-router'

import { exploreSearchSchema } from '#/lib/openalex.ts'

export const Route = createFileRoute('/dashboard/explore')({
  validateSearch: (search) => exploreSearchSchema.parse(search),
  component: ExploreLayout,
})

function ExploreLayout() {
  return <Outlet />
}
