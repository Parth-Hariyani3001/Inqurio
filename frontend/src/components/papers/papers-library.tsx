import { PapersCatalog, PapersCatalogSkeleton } from '#/components/papers/papers-catalog.tsx'
import { PapersEmpty, PapersError } from '#/components/papers/papers-status.tsx'
import { PapersToolbar } from '#/components/papers/papers-toolbar.tsx'
import { usePapersLibrary } from '#/components/papers/use-papers-library.ts'

export function PapersLibrary() {
  const library = usePapersLibrary()

  return (
    <div className="flex flex-1 flex-col gap-6">
      <PapersToolbar
        searchDraft={library.searchDraft}
        onSubmit={library.applySearch}
        onSearchDraftChange={library.onSearchDraftChange}
      />

      {library.showError ? (
        <PapersError message={library.errorMessage} />
      ) : library.showSkeleton ? (
        <PapersCatalogSkeleton />
      ) : library.showEmpty ? (
        <PapersEmpty hasQuery={library.query.length > 0} />
      ) : (
        <PapersCatalog
          query={library.query}
          results={library.results}
          rangeStart={library.rangeStart}
          rangeEnd={library.rangeEnd}
          hasPrev={library.hasPrev}
          hasNext={library.hasNext}
          isFetching={library.isFetching}
          onPrev={library.goPrev}
          onNext={library.goNext}
        />
      )}
    </div>
  )
}
