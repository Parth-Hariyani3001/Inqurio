import { useAuth } from '@clerk/tanstack-react-start'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'

import {
  listSessionsQueryOptions,
  sessionsSearchToParams,
  toSessionsSearch,
} from '#/lib/sessions.ts'

const chatsRoute = getRouteApi('/dashboard/chats/')

export function useChatsLibrary() {
  const search = chatsRoute.useSearch()
  const navigate = chatsRoute.useNavigate()
  const { isLoaded, getToken } = useAuth()

  const params = sessionsSearchToParams(search)
  const sessionsQuery = useQuery(
    listSessionsQueryOptions(params, getToken, isLoaded),
  )

  function goNext() {
    void navigate({
      search: toSessionsSearch(params.offset + params.limit),
      replace: true,
    })
  }

  function goPrev() {
    void navigate({
      search: toSessionsSearch(Math.max(0, params.offset - params.limit)),
      replace: true,
    })
  }

  const results = sessionsQuery.data ?? []
  const rangeStart = results.length > 0 ? params.offset + 1 : 0
  const rangeEnd = results.length > 0 ? params.offset + results.length : 0

  return {
    results,
    rangeStart,
    rangeEnd,
    hasPrev: params.offset > 0,
    hasNext: results.length === params.limit,
    isFetching: sessionsQuery.isFetching,
    showSkeleton:
      sessionsQuery.isPending ||
      (sessionsQuery.isFetching && sessionsQuery.isPlaceholderData),
    showError: sessionsQuery.isError,
    showEmpty: sessionsQuery.isSuccess && results.length === 0,
    errorMessage:
      sessionsQuery.error instanceof Error
        ? sessionsQuery.error.message
        : 'The chats request failed. Try again.',
    goNext,
    goPrev,
  }
}
