import { BookMarked, Search } from 'lucide-react'
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

export function PapersError({ message }: { message: string }) {
  return (
    <Empty className="flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyTitle>Could not load papers</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function PapersEmpty({ hasQuery }: { hasQuery: boolean }) {
  return (
    <Empty className="flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {hasQuery ? <Search /> : <BookMarked />}
        </EmptyMedia>
        <EmptyTitle>
          {hasQuery ? 'No papers matched' : 'No ingested papers yet'}
        </EmptyTitle>
        <EmptyDescription>
          {hasQuery
            ? 'Try a broader title or author query.'
            : 'Find a work in Explore and add it. Parsed papers will collect here.'}
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
