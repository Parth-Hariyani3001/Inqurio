import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { auth } from '@clerk/tanstack-react-start/server'
import { isNotFound, notFound, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { ApiError, apiFetch, getApiBaseUrl } from '#/lib/api.ts'

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

export type PaperCitation = {
  chunk_id: string
  section: string
  excerpt: string
}

export type WebCitation = {
  title: string
  url: string
  snippet: string
}

export type MessageCitations = {
  paper: Array<PaperCitation>
  web: Array<WebCitation>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseMessageCitations(
  citations: unknown,
): MessageCitations | null {
  if (!isRecord(citations)) return null

  const paperRaw = Array.isArray(citations.paper) ? citations.paper : []
  const webRaw = Array.isArray(citations.web) ? citations.web : []

  const paper: Array<PaperCitation> = []
  for (const item of paperRaw) {
    if (!isRecord(item)) continue
    const chunkId = item.chunk_id
    if (typeof chunkId !== 'string' || !chunkId) continue
    paper.push({
      chunk_id: chunkId,
      section: typeof item.section === 'string' ? item.section : '',
      excerpt: typeof item.excerpt === 'string' ? item.excerpt : '',
    })
  }

  const web: Array<WebCitation> = []
  for (const item of webRaw) {
    if (!isRecord(item)) continue
    const url = item.url
    if (typeof url !== 'string' || !url) continue
    web.push({
      title: typeof item.title === 'string' && item.title ? item.title : url,
      url,
      snippet: typeof item.snippet === 'string' ? item.snippet : '',
    })
  }

  if (paper.length === 0 && web.length === 0) return null
  return { paper, web }
}

/** @deprecated Prefer parseMessageCitations for structured sources. */
export function citationLines(citations: unknown): Array<string> | null {
  const parsed = parseMessageCitations(citations)
  if (!parsed) return null
  const lines: Array<string> = []
  for (const item of parsed.paper) {
    lines.push(item.section || item.excerpt || item.chunk_id)
  }
  for (const item of parsed.web) {
    lines.push(item.title)
  }
  return lines.length > 0 ? lines : null
}

export type StreamMessageHandlers = {
  onUserMessage?: (message: MessageResponse) => void
  onAssistantDelta?: (delta: string) => void
  onAssistantDone?: (message: MessageResponse) => void
  onError?: (detail: string) => void
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split(/\r?\n/)
  let event = 'message'
  const dataLines: Array<string> = []

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) return null
  return { event, data: dataLines.join('\n') }
}

export async function streamSessionMessage(
  sessionId: string,
  content: string,
  getToken: () => Promise<string | null>,
  handlers: StreamMessageHandlers = {},
) {
  const token = await getToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    },
  )

  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const data: unknown = await response.json()
      if (isRecord(data) && typeof data.message === 'string' && data.message) {
        detail = data.message
      } else if (isRecord(data) && typeof data.detail === 'string' && data.detail) {
        detail = data.detail
      }
    } catch {
      // ignore body parse errors
    }
    throw new ApiError(detail, { status: response.status })
  }

  if (!response.body) {
    throw new Error('No response stream')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split(/\r?\n\r?\n/)
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const parsed = parseSseBlock(part)
      if (!parsed) continue

      let payload: unknown = null
      try {
        payload = JSON.parse(parsed.data)
      } catch {
        continue
      }

      if (parsed.event === 'message.user' && isRecord(payload)) {
        handlers.onUserMessage?.(payload.message as MessageResponse)
        continue
      }
      if (parsed.event === 'message.assistant.delta' && isRecord(payload)) {
        if (typeof payload.delta === 'string' && payload.delta) {
          handlers.onAssistantDelta?.(payload.delta)
        }
        continue
      }
      if (parsed.event === 'message.assistant.done' && isRecord(payload)) {
        handlers.onAssistantDone?.(payload.message as MessageResponse)
        continue
      }
      if (parsed.event === 'error' && isRecord(payload)) {
        const detail =
          typeof payload.detail === 'string' && payload.detail
            ? payload.detail
            : 'Chat failed'
        handlers.onError?.(detail)
      }
    }
  }
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

export async function updateSessionTitle(
  sessionId: string,
  title: string,
  getToken: () => Promise<string | null>,
) {
  const token = await getToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  return apiFetch<SessionResponse>(
    `/api/v1/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: 'PATCH',
      token,
      data: { title },
    },
  )
}

export async function deleteSession(
  sessionId: string,
  getToken: () => Promise<string | null>,
) {
  const token = await getToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  await apiFetch<void>(`/api/v1/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    token,
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
