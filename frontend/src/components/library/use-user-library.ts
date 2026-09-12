import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '@clerk/tanstack-react-start'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'

import {
  librarySearchToParams,
  listUserPapersQueryOptions,
  toLibrarySearch,
} from '#/lib/user-papers.ts'

const libraryRoute = getRouteApi('/dashboard/library/')

export function useUserLibrary() {
  const search = libraryRoute.useSearch()
  const navigate = libraryRoute.useNavigate()
  const { isLoaded, getToken } = useAuth()

  const [searchDraft, setSearchDraft] = useState(search.q ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const lastCommittedQRef = useRef(search.q ?? '')

  const params = librarySearchToParams(search)
  const papersQuery = useQuery(
    listUserPapersQueryOptions(params, getToken, isLoaded),
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
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  function commitSearch(query: string, offset?: number) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    lastCommittedQRef.current = query.trim()
    void navigate({
      search: toLibrarySearch(query, offset),
      replace: true,
    })
  }

  function applySearch(event?: FormEvent) {
    event?.preventDefault()
    commitSearch(searchDraft, 0)
  }

  function onSearchDraftChange(value: string) {
    setSearchDraft(value)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      commitSearch(value, 0)
    }, 500)
  }

  function goNext() {
    commitSearch(params.search, params.offset + params.limit)
  }

  function goPrev() {
    commitSearch(params.search, Math.max(0, params.offset - params.limit))
  }

  const results = papersQuery.data ?? []
  const rangeStart = results.length > 0 ? params.offset + 1 : 0
  const rangeEnd = results.length > 0 ? params.offset + results.length : 0
  const query = params.search

  return {
    searchDraft,
    query,
    results,
    rangeStart,
    rangeEnd,
    hasPrev: params.offset > 0,
    hasNext: results.length === params.limit,
    isFetching: papersQuery.isFetching,
    showSkeleton:
      papersQuery.isPending ||
      (papersQuery.isFetching && papersQuery.isPlaceholderData),
    showError: papersQuery.isError,
    showEmpty: papersQuery.isSuccess && results.length === 0,
    errorMessage:
      papersQuery.error instanceof Error
        ? papersQuery.error.message
        : 'The library request failed. Try again.',
    applySearch,
    onSearchDraftChange,
    goNext,
    goPrev,
  }
}
