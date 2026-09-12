import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { auth } from '@clerk/tanstack-react-start/server'
import { isNotFound, notFound, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { ApiError, apiFetch } from '#/lib/api.ts'

export const SORT_OPTIONS = [
  { id: 'relevance_score:desc', label: 'Relevance' },
  { id: 'cited_by_count:desc', label: 'Most cited' },
  { id: 'publication_date:desc', label: 'Newest' },
  { id: 'publication_date:asc', label: 'Oldest' },
] as const

export type SortOptionId = (typeof SORT_OPTIONS)[number]['id']
export type OpenAccessFilter = 'any' | 'open' | 'closed'

export const OPENALEX_PER_PAGE = 25

export type OpenAlexFilters = {
  search: string
  openAccess: OpenAccessFilter
  fromYear: string
  toYear: string
  sort: SortOptionId
}

export const DEFAULT_OPENALEX_FILTERS: OpenAlexFilters = {
  search: '',
  openAccess: 'any',
  fromYear: '',
  toYear: '',
  sort: 'relevance_score:desc',
}

export const exploreSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  oa: z.enum(['any', 'open', 'closed']).optional().catch(undefined),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  sort: z
    .enum([
      'relevance_score:desc',
      'cited_by_count:desc',
      'publication_date:desc',
      'publication_date:asc',
    ])
    .optional()
    .catch(undefined),
  cursor: z.string().optional().catch(undefined),
  src: z.enum(['papers', 'library']).optional().catch(undefined),
  offset: z.coerce.number().int().min(0).optional().catch(undefined),
})

export type ExploreSearch = z.infer<typeof exploreSearchSchema>

export type SearchWorksParams = {
  search: string
  open_access: OpenAccessFilter
  from_year?: number
  to_year?: number
  sort: SortOptionId
  per_page: number
  cursor?: string
}

export type OpenAlexWork = {
  id: string
  doi: string | null
  display_name: string
  publication_year: number | null
  cited_by_count: number
  is_oa: boolean
  authors: Array<string>
  venue: string | null
  tags?: Array<string>
}

export type OpenAlexWorksResponse = {
  meta: {
    count: number
    per_page: number
    next_cursor: string | null
  }
  results: Array<OpenAlexWork>
}

export type IngestStatus = 'pending' | 'processing' | 'ready' | 'failed'

export type OpenAlexWorkDetail = OpenAlexWork & {
  abstract: string | null
  publication_date: string | null
  type: string | null
  language: string | null
  is_retracted: boolean
  oa_url: string | null
  institutions: Array<string>
  topics: Array<string>
  in_database: boolean
  paper_id: string | null
  ingest_status: IngestStatus | null
}

export const getWorkDetail = createServerFn({ method: 'GET' })
  .validator(z.object({ workId: z.string().min(1) }))
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
      return await apiFetch<OpenAlexWorkDetail>(
        `/api/v1/openalex/works/${encodeURIComponent(data.workId)}`,
        { token },
      )
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        throw notFound()
      }
      throw error
    }
  })

export function workDetailQueryOptions(workId: string) {
  return queryOptions({
    queryKey: ['openalex', 'work', workId],
    queryFn: async () => {
      try {
        return await getWorkDetail({ data: { workId } })
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

export function formatDoi(doi: string) {
  return doi.replace(/^https?:\/\/doi\.org\//i, '')
}

export function parseYear(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 9999) {
    return undefined
  }
  return parsed
}

export function exploreSearchToFilters(search: ExploreSearch): OpenAlexFilters {
  return {
    search: search.q ?? '',
    openAccess: search.oa ?? DEFAULT_OPENALEX_FILTERS.openAccess,
    fromYear: search.from ?? '',
    toYear: search.to ?? '',
    sort: search.sort ?? DEFAULT_OPENALEX_FILTERS.sort,
  }
}

export function filtersToExploreSearch(
  filters: OpenAlexFilters,
  cursor?: string,
): ExploreSearch {
  const q = filters.search.trim()
  const from = filters.fromYear.trim()
  const to = filters.toYear.trim()

  return {
    ...(q ? { q } : {}),
    ...(filters.openAccess !== DEFAULT_OPENALEX_FILTERS.openAccess
      ? { oa: filters.openAccess }
      : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(filters.sort !== DEFAULT_OPENALEX_FILTERS.sort
      ? { sort: filters.sort }
      : {}),
    ...(cursor ? { cursor } : {}),
  }
}

export function toSearchWorksParams(
  filters: OpenAlexFilters,
  cursor?: string,
): SearchWorksParams {
  return {
    search: filters.search.trim(),
    open_access: filters.openAccess,
    from_year: parseYear(filters.fromYear),
    to_year: parseYear(filters.toYear),
    sort: filters.sort,
    per_page: OPENALEX_PER_PAGE,
    ...(cursor ? { cursor } : {}),
  }
}

export function searchWorksQueryOptions(
  params: SearchWorksParams,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ['openalex', 'works', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      return apiFetch<OpenAlexWorksResponse>('/api/v1/openalex/works', {
        token,
        params: {
          search: params.search,
          open_access: params.open_access,
          from_year: params.from_year,
          to_year: params.to_year,
          sort: params.sort,
          per_page: params.per_page,
          cursor: params.cursor ?? '*',
        },
      })
    },
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}
