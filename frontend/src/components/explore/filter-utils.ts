import type {
  OpenAccessFilter,
  OpenAlexFilters,
  SortOptionId,
} from '#/lib/openalex.ts'
import { DEFAULT_OPENALEX_FILTERS, SORT_OPTIONS } from '#/lib/openalex.ts'

export const OPEN_ACCESS_OPTIONS: Array<{
  id: OpenAccessFilter
  label: string
}> = [
  { id: 'any', label: 'Any' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
]

export function countActiveFilters(filters: OpenAlexFilters) {
  let count = 0
  if (filters.openAccess !== DEFAULT_OPENALEX_FILTERS.openAccess) count += 1
  if (filters.fromYear.trim()) count += 1
  if (filters.toYear.trim()) count += 1
  if (filters.sort !== DEFAULT_OPENALEX_FILTERS.sort) count += 1
  return count
}

export function sortLabel(id: SortOptionId) {
  return SORT_OPTIONS.find((item) => item.id === id)?.label ?? id
}

export function openAccessLabel(id: OpenAccessFilter) {
  return OPEN_ACCESS_OPTIONS.find((item) => item.id === id)?.label ?? id
}

export function filterKey(filters: OpenAlexFilters) {
  return [
    filters.search.trim(),
    filters.openAccess,
    filters.fromYear.trim(),
    filters.toYear.trim(),
    filters.sort,
  ].join('|')
}
