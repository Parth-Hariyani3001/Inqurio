import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { apiFetch } from '#/lib/api.ts'
import type { IngestStatus } from '#/lib/openalex.ts'

export const PAPERS_PER_PAGE = 50

export type PaperUploadResult = {
  success: boolean
  message: string
  paper_id: string
  status: IngestStatus
  ready: boolean
}

export type PaperResponse = {
  uid: string
  title: string
  authors: Array<string>
  openalex_id: string
  doi: string | null
  status: IngestStatus
  abstract?: string | null
  already_added: boolean
}

export type PaperPdfUrlResponse = {
  url: string
  expires_in: number
  paper: PaperResponse
}

export type ListPapersParams = {
  search: string
  limit: number
  offset: number
}

export const papersSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  offset: z.coerce.number().int().min(0).optional().catch(undefined),
})

export type PapersSearch = z.infer<typeof papersSearchSchema>

export function papersSearchToParams(search: PapersSearch): ListPapersParams {
  return {
    search: (search.q ?? '').trim(),
    limit: PAPERS_PER_PAGE,
    offset: search.offset ?? 0,
  }
}

export function toPapersSearch(
  query: string,
  offset?: number,
): PapersSearch {
  const q = query.trim()
  const nextOffset = offset && offset > 0 ? offset : undefined

  return {
    ...(q ? { q } : {}),
    ...(nextOffset ? { offset: nextOffset } : {}),
  }
}

export async function uploadPaper(
  openalexId: string,
  getToken: () => Promise<string | null>,
) {
  const token = await getToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  return apiFetch<PaperUploadResult>('/api/v1/papers/upload', {
    method: 'POST',
    token,
    data: { openalex_id: openalexId },
  })
}

export function listPapersQueryOptions(
  params: ListPapersParams,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ['papers', 'list', params],
    queryFn: async () => {
      const token = await getToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      return apiFetch<Array<PaperResponse>>('/api/v1/papers/', {
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

export function paperPdfUrlQueryOptions(
  paperId: string,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ['papers', 'pdf-url', paperId],
    queryFn: async () => {
      const token = await getToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      return apiFetch<PaperPdfUrlResponse>(
        `/api/v1/papers/${encodeURIComponent(paperId)}/pdf-url`,
        { token },
      )
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const expiresIn = query.state.data?.expires_in
      if (!expiresIn) return false
      return Math.max(10_000, (expiresIn - 30) * 1000)
    },
  })
}

export function ingestStatusLabel(status: IngestStatus) {
  if (status === 'ready') return 'Parsed'
  if (status === 'processing') return 'Parsing'
  if (status === 'pending') return 'Parsing queued'
  return 'Parse failed'
}

export function toOpenAlexWorkId(openalexId: string) {
  return openalexId.replace(/^https?:\/\/openalex\.org\//i, '')
}

