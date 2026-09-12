import { MessageSquare } from 'lucide-react'
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

export function ChatsError({ message }: { message: string }) {
  return (
    <Empty className="flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyTitle>Could not load chats</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function ChatsEmpty() {
  return (
    <Empty className="flex-1 border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquare />
        </EmptyMedia>
        <EmptyTitle>No chats yet</EmptyTitle>
        <EmptyDescription>
          Open a parsed paper and start a chat. The paper stays beside the
          thread so you can read and ask in one place.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link className={buttonVariants()} to="/dashboard/papers">
          Open Papers
        </Link>
      </EmptyContent>
    </Empty>
  )
}
