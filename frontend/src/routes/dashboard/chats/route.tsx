import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/chats')({
  component: ChatsLayout,
})

function ChatsLayout() {
  return <Outlet />
}
