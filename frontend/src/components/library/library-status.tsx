import { Library, Search } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { buttonVariants } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export function LibraryError({ message }: { message: string }) {
  return (
    <Empty className="flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyTitle>Could not load your library</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function LibraryEmpty({ hasQuery }: { hasQuery: boolean }) {
  return (
    <Empty className="flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {hasQuery ? <Search /> : <Library />}
        </EmptyMedia>
        <EmptyTitle>
          {hasQuery ? 'No papers matched' : 'Your library is empty'}
        </EmptyTitle>
        <EmptyDescription>
          {hasQuery
            ? 'Try a broader title or author query.'
            : 'Find a work in Explore and add it to your list. Parsed papers you add will show here.'}
        </EmptyDescription>
      </EmptyHeader>
      {hasQuery ? null : (
        <EmptyContent>
          <Link className={buttonVariants()} to="/dashboard/explore">
            Open Explore
          </Link>
        </EmptyContent>
      )}
    </Empty>
  )
}
