import {
  LibraryCatalog,
  LibraryCatalogSkeleton,
} from '#/components/library/library-catalog.tsx'
import { LibraryEmpty, LibraryError } from '#/components/library/library-status.tsx'
import { LibraryToolbar } from '#/components/library/library-toolbar.tsx'
import { useUserLibrary } from '#/components/library/use-user-library.ts'

export function UserLibrary() {
  const library = useUserLibrary()

  return (
    <div className="flex flex-1 flex-col gap-6">
      <LibraryToolbar
        searchDraft={library.searchDraft}
        onSubmit={library.applySearch}
        onSearchDraftChange={library.onSearchDraftChange}
      />

      {library.showError ? (
        <LibraryError message={library.errorMessage} />
      ) : library.showSkeleton ? (
        <LibraryCatalogSkeleton />
      ) : library.showEmpty ? (
        <LibraryEmpty hasQuery={library.query.length > 0} />
      ) : (
        <LibraryCatalog
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
