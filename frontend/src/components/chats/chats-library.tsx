import {
  ChatsCatalog,
  ChatsCatalogSkeleton,
} from '#/components/chats/chats-catalog.tsx'
import { ChatsEmpty, ChatsError } from '#/components/chats/chats-status.tsx'
import { useChatsLibrary } from '#/components/chats/use-chats-library.ts'

export function ChatsLibrary() {
  const chats = useChatsLibrary()

  return (
    <div className="flex flex-1 flex-col gap-6">
      {chats.showError ? (
        <ChatsError message={chats.errorMessage} />
      ) : chats.showSkeleton ? (
        <ChatsCatalogSkeleton />
      ) : chats.showEmpty ? (
        <ChatsEmpty />
      ) : (
        <ChatsCatalog
          results={chats.results}
          rangeStart={chats.rangeStart}
          rangeEnd={chats.rangeEnd}
          hasPrev={chats.hasPrev}
          hasNext={chats.hasNext}
          isFetching={chats.isFetching}
          onPrev={chats.goPrev}
          onNext={chats.goNext}
        />
      )}
    </div>
  )
}
