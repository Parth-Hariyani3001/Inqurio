import { Search } from 'lucide-react'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export function SearchIdle() {
  return (
    <Empty className="flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Search />
        </EmptyMedia>
        <EmptyTitle>Open a query</EmptyTitle>
        <EmptyDescription>
          Search a paper title, author, or topic. Matching works will line up
          here as a contents list.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function SearchError({ message }: { message: string }) {
  return (
    <Empty className="flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyTitle>Could not load works</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function SearchNoResults() {
  return (
    <Empty className="flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyTitle>No works matched</EmptyTitle>
        <EmptyDescription>
          Broaden the query or clear a filter, then search again.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
