import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { auth } from '@clerk/tanstack-react-start/server'
import { isNotFound, notFound, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { ApiError, apiFetch } from '#/lib/api.ts'

export const SESSIONS_PER_PAGE = 50
export const RECENT_SESSIONS = 8

export type ChatRole = 'user' | 'assistant'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | Array<JsonValue>
  | { [key: string]: JsonValue }

export type MessageResponse = {
  uid: string
  content: string
  role: ChatRole
  citations: JsonValue
  created_at: string
}

export type SessionListItem = {
  uid: string
  title: string
  paper_id: string
  paper_title: string
  created_at: string
}

export type SessionResponse = {
  uid: string
  title: string
  paper_id: string
  created_at: string
}

export type SessionDetailResponse = SessionResponse & {
  messages: Array<MessageResponse>
}

export type ListSessionsParams = {
  limit: number
  offset: number
}

export const sessionsSearchSchema = z.object({
  offset: z.coerce.number().int().min(0).optional().catch(undefined),
})

export type SessionsSearch = z.infer<typeof sessionsSearchSchema>

export function sessionsSearchToParams(
  search: SessionsSearch,
): ListSessionsParams {
  return {
    limit: SESSIONS_PER_PAGE,
    offset: search.offset ?? 0,
  }
}

export function toSessionsSearch(offset?: number): SessionsSearch {
  const nextOffset = offset && offset > 0 ? offset : undefined
  return nextOffset ? { offset: nextOffset } : {}
}

export function formatSessionDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date)
}

export function citationLines(citations: unknown): Array<string> | null {
  if (!Array.isArray(citations)) return null
  if (citations.length === 0) return null
  if (!citations.every((item) => typeof item === 'string')) return null
  return citations
}

export async function createSession(
  paperId: string,
  getToken: () => Promise<string | null>,
) {
  const token = await getToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  return apiFetch<SessionResponse>('/api/v1/sessions/', {
    method: 'POST',
    token,
    data: { paper_id: paperId },
  })
}

export function listSessionsQueryOptions(
  params: ListSessionsParams,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ['sessions', 'list', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      return apiFetch<Array<SessionListItem>>('/api/v1/sessions/', {
        token,
        params: {
          limit: params.limit,
          offset: params.offset,
        },
      })
    },
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function recentSessionsQueryOptions(
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return listSessionsQueryOptions(
    { limit: RECENT_SESSIONS, offset: 0 },
    getToken,
    enabled,
  )
}

export const getSessionDetail = createServerFn({ method: 'GET' })
  .validator(z.object({ sessionId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { isAuthenticated, getToken } = await auth()
    if (!isAuthenticated) {
      throw redirect({
        to: '/sign-in/$',
        replace: true,
      })
    }

    const token = await getToken()
    if (!token) {
      throw redirect({
        to: '/sign-in/$',
        replace: true,
      })
    }

    try {
      return await apiFetch<SessionDetailResponse>(
        `/api/v1/sessions/${encodeURIComponent(data.sessionId)}`,
        { token },
      )
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw notFound()
      }
      throw error
    }
  })

export function sessionDetailQueryOptions(sessionId: string) {
  return queryOptions({
    queryKey: ['sessions', 'detail', sessionId],
    queryFn: async () => {
      try {
        return await getSessionDetail({ data: { sessionId } })
      } catch (error) {
        if (isNotFound(error)) {
          throw error
        }
        if (error instanceof ApiError && error.status === 404) {
          throw notFound()
        }
        throw error
      }
    },
    staleTime: 30_000,
  })
}
