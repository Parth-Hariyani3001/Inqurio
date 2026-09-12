import {
  SearchIdle,
  SearchError,
  SearchNoResults,
} from '#/components/explore/search-status.tsx'
import { SearchToolbar } from '#/components/explore/search-toolbar.tsx'
import { useOpenAlexSearch } from '#/components/explore/use-openalex-search.ts'
import {
  WorksCatalog,
  WorksCatalogSkeleton,
} from '#/components/explore/works-catalog.tsx'

export function OpenAlexSearch() {
  const search = useOpenAlexSearch()

  return (
    <div className="flex flex-1 flex-col gap-6">
      <SearchToolbar
        searchDraft={search.searchDraft}
        filters={search.filters}
        draft={search.draft}
        setDraft={search.setDraft}
        filtersOpen={search.filtersOpen}
        setFiltersOpen={search.setFiltersOpen}
        onSubmit={search.applySearch}
        onSearchDraftChange={search.onSearchDraftChange}
        onOpenFilters={() =>
          search.setDraft({
            ...search.filters,
            search: search.searchDraft,
          })
        }
        onSortChange={search.onSortChange}
        onOpenAccessChange={search.onOpenAccessChange}
        onResetFilters={search.resetDraftFilters}
        onApplyFilters={search.applyDraftFilters}
        onRemoveFilter={search.updateCommittedFilter}
      />

      {search.showInitial ? (
        <SearchIdle />
      ) : search.showError ? (
        <SearchError message={search.errorMessage} />
      ) : search.showSkeleton ? (
        <WorksCatalogSkeleton />
      ) : search.showEmpty ? (
        <SearchNoResults />
      ) : (
        <WorksCatalog
          query={search.query}
          results={search.results}
          rangeStart={search.rangeStart}
          rangeEnd={search.rangeEnd}
          totalCount={search.totalCount}
          hasPrev={search.hasPrev}
          hasNext={search.hasNext}
          isFetching={search.isFetching}
          onPrev={search.goPrev}
          onNext={search.goNext}
        />
      )}
    </div>
  )
}
