import { keepPreviousData, queryOptions } from '@tanstack/react-query'

import { apiFetch } from '#/lib/api.ts'

export const HIGHLIGHT_COLORS = [
  { id: '#F4D35E', label: 'Yellow' },
  { id: '#7DCEA0', label: 'Green' },
  { id: '#85C1E9', label: 'Blue' },
  { id: '#F5B7B1', label: 'Pink' },
] as const

export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0].id
export const DRAFT_ANNOTATION_ID = 'draft'

export type AnnotationRect = {
  x: number
  y: number
  width: number
  height: number
}

export type AnnotationSelection = {
  pageNumber: number
  rects: Array<AnnotationRect>
  selectedText: string
}

export type AnnotationResponse = {
  uid: string
  paper_id: string
  content: string
  selection: AnnotationSelection
  color: string
  created_at: string
  updated_at: string | null
}

export type AnnotationCreate = {
  content?: string
  color: string
  selection: AnnotationSelection
}

export type AnnotationUpdate = {
  content?: string
  color?: string
}

export function isAnnotationSelection(
  value: unknown,
): value is AnnotationSelection {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.pageNumber === 'number' &&
    Array.isArray(record.rects) &&
    typeof record.selectedText === 'string'
  )
}

export function annotationsQueryOptions(
  paperId: string,
  getToken: () => Promise<string | null>,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ['papers', 'annotations', paperId],
    queryFn: async () => {
      const token = await getToken()
      if (!token) {
        throw new Error('Not authenticated')
      }

      const rows = await apiFetch<Array<AnnotationResponse>>(
        `/api/v1/papers/${encodeURIComponent(paperId)}/annotations`,
        { token },
      )

      return rows.filter((row) => isAnnotationSelection(row.selection))
    },
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export async function createAnnotation(
  paperId: string,
  payload: AnnotationCreate,
  getToken: () => Promise<string | null>,
) {
  const token = await getToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  return apiFetch<AnnotationResponse>(
    `/api/v1/papers/${encodeURIComponent(paperId)}/annotations`,
    {
      method: 'POST',
      token,
      data: payload,
    },
  )
}

export async function updateAnnotation(
  annotationId: string,
  payload: AnnotationUpdate,
  getToken: () => Promise<string | null>,
) {
  const token = await getToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  return apiFetch<AnnotationResponse>(
    `/api/v1/annotations/${encodeURIComponent(annotationId)}`,
    {
      method: 'PATCH',
      token,
      data: payload,
    },
  )
}

export async function deleteAnnotation(
  annotationId: string,
  getToken: () => Promise<string | null>,
) {
  const token = await getToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  await apiFetch(`/api/v1/annotations/${encodeURIComponent(annotationId)}`, {
    method: 'DELETE',
    token,
  })
}
