import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { apiFetch } from '#/lib/api.ts'
import type { IngestStatus } from '#/lib/openalex.ts'

export const USER_PAPERS_PER_PAGE = 50

export type UserPaperResponse = {
  uid: string
  title: string
  authors: Array<string>
  openalex_id: string
  doi: string | null
  status: IngestStatus
  abstract?: string | null
  added_at: string
  custom_tags: Array<string>
}

export type ListUserPapersParams = {
  search: string
  limit: number
  offset: number
}

export const librarySearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  offset: z.coerce.number().int().min(0).optional().catch(undefined),
})

export type LibrarySearch = z.infer<typeof librarySearchSchema>

export function librarySearchToParams(
  search: LibrarySearch,
): ListUserPapersParams {
  return {
    search: (search.q ?? '').trim(),
    limit: USER_PAPERS_PER_PAGE,
    offset: search.offset ?? 0,
  }
}

export function toLibrarySearch(query: string, offset?: number): LibrarySearch {
  const q = query.trim()
  const nextOffset = offset && offset > 0 ? offset : undefined

  return {
    ...(q ? { q } : {}),
    ...(nextOffset ? { offset: nextOffset } : {}),
  }
}

export function formatAddedAt(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date)
}

export function listUserPapersQueryOptions(
  params: ListUserPapersParams,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ['user-papers', 'list', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      return apiFetch<Array<UserPaperResponse>>('/api/v1/user-papers/', {
        token,
        params: {
          search: params.search || undefined,
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
