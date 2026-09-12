import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '@clerk/tanstack-react-start'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { Key, Selection } from 'react-aria-components'

import { filterKey } from '#/components/explore/filter-utils.ts'
import type {
  OpenAccessFilter,
  OpenAlexFilters,
  SortOptionId,
} from '#/lib/openalex.ts'
import {
  DEFAULT_OPENALEX_FILTERS,
  OPENALEX_PER_PAGE,
  exploreSearchToFilters,
  filtersToExploreSearch,
  searchWorksQueryOptions,
  toSearchWorksParams,
} from '#/lib/openalex.ts'

const exploreRoute = getRouteApi('/dashboard/explore')

let cursorStack: Array<string> = []
let cursorStackFilterKey = ''

export function useOpenAlexSearch() {
  const search = exploreRoute.useSearch()
  const navigate = exploreRoute.useNavigate()
  const { isLoaded, getToken } = useAuth()

  const filters = exploreSearchToFilters(search)
  const [searchDraft, setSearchDraft] = useState(search.q ?? '')
  const [draft, setDraft] = useState<OpenAlexFilters>(filters)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const lastCommittedQRef = useRef(search.q ?? '')
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const query = filters.search.trim()
  const worksParams = toSearchWorksParams(filters, search.cursor)
  const worksQuery = useQuery(
    searchWorksQueryOptions(
      worksParams,
      getToken,
      isLoaded && query.length >= 1,
    ),
  )

  useEffect(() => {
    const urlQ = search.q ?? ''
    if (urlQ === lastCommittedQRef.current) return
    
    lastCommittedQRef.current = urlQ
    setSearchDraft(urlQ)
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
  }, [search.q])

  useEffect(() => {
    const nextKey = filterKey(filters)
    if (cursorStackFilterKey !== nextKey) {
      cursorStack = []
      cursorStackFilterKey = nextKey
    }
  }, [filters])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  function commitFilters(next: OpenAlexFilters, cursor?: string) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    lastCommittedQRef.current = next.search.trim()
    void navigate({
      search: filtersToExploreSearch(next, cursor),
      replace: true,
    })
  }

  function applySearch(event?: FormEvent) {
    event?.preventDefault()
    commitFilters({ ...filters, search: searchDraft })
  }

  function onSearchDraftChange(value: string) {
    setSearchDraft(value)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      commitFilters({ ...filtersRef.current, search: value })
    }, 500)
  }

  function applyDraftFilters() {
    commitFilters({ ...draft, search: filters.search })
    setFiltersOpen(false)
  }

  function resetDraftFilters() {
    setDraft({ ...DEFAULT_OPENALEX_FILTERS, search: draft.search })
  }

  function updateCommittedFilter<TKey extends keyof OpenAlexFilters>(
    key: TKey,
    value: OpenAlexFilters[TKey],
  ) {
    commitFilters({ ...filters, [key]: value })
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function onSortChange(key: Key | null) {
    if (typeof key === 'string') {
      setDraft((current) => ({ ...current, sort: key as SortOptionId }))
    }
  }

  function onOpenAccessChange(selection: Selection) {
    if (selection === 'all') return
    const next = [...selection][0]
    if (typeof next === 'string') {
      setDraft((current) => ({
        ...current,
        openAccess: next as OpenAccessFilter,
      }))
    }
  }

  function goNext() {
    const nextCursor = worksQuery.data?.meta.next_cursor
    if (!nextCursor) return
    cursorStack = [...cursorStack, search.cursor ?? '']
    commitFilters(filters, nextCursor)
  }

  function goPrev() {
    if (cursorStack.length === 0) {
      if (!search.cursor) return
      commitFilters(filters)
      return
    }
    
    const previous = cursorStack[cursorStack.length - 1]
    cursorStack = cursorStack.slice(0, -1)
    commitFilters(filters, previous || undefined)
  }

  const results = worksQuery.data?.results ?? []
  const perPage = worksQuery.data?.meta.per_page ?? OPENALEX_PER_PAGE
  const pageIndex = cursorStack.length
  const rangeStart = results.length > 0 ? pageIndex * perPage + 1 : 0
  const rangeEnd = results.length > 0 ? rangeStart + results.length - 1 : 0

  return {
    filters,
    searchDraft,
    draft,
    setDraft,
    filtersOpen,
    setFiltersOpen,
    query,
    results,
    rangeStart,
    rangeEnd,
    totalCount: worksQuery.data?.meta.count,
    hasPrev: cursorStack.length > 0 || Boolean(search.cursor),
    hasNext: Boolean(worksQuery.data?.meta.next_cursor),
    isFetching: worksQuery.isFetching,
    showSkeleton:
      worksQuery.isPending ||
      (worksQuery.isFetching && worksQuery.isPlaceholderData),
    showInitial: query.length === 0,
    showError: query.length >= 1 && worksQuery.isError,
    showEmpty:
      query.length >= 1 && worksQuery.isSuccess && results.length === 0,
    errorMessage:
      worksQuery.error instanceof Error
        ? worksQuery.error.message
        : 'The search request failed. Try again.',
    applySearch,
    onSearchDraftChange,
    applyDraftFilters,
    resetDraftFilters,
    updateCommittedFilter,
    onSortChange,
    onOpenAccessChange,
    goNext,
    goPrev,
  }
}
