import type { FormEvent } from 'react'
import { Search } from 'lucide-react'
import type { Key, Selection } from 'react-aria-components'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { FilterChips } from '#/components/explore/filter-chips.tsx'
import { FiltersPopover } from '#/components/explore/filters-popover.tsx'
import { countActiveFilters } from '#/components/explore/filter-utils.ts'
import type { OpenAlexFilters } from '#/lib/openalex.ts'

export function SearchToolbar({
  searchDraft,
  filters,
  draft,
  setDraft,
  filtersOpen,
  setFiltersOpen,
  onSubmit,
  onSearchDraftChange,
  onOpenFilters,
  onSortChange,
  onOpenAccessChange,
  onResetFilters,
  onApplyFilters,
  onRemoveFilter,
}: {
  searchDraft: string
  filters: OpenAlexFilters
  draft: OpenAlexFilters
  setDraft: (
    value: OpenAlexFilters | ((current: OpenAlexFilters) => OpenAlexFilters),
  ) => void
  filtersOpen: boolean
  setFiltersOpen: (open: boolean) => void
  onSubmit: (event?: FormEvent) => void
  onSearchDraftChange: (value: string) => void
  onOpenFilters: () => void
  onSortChange: (key: Key | null) => void
  onOpenAccessChange: (selection: Selection) => void
  onResetFilters: () => void
  onApplyFilters: () => void
  onRemoveFilter: <TKey extends keyof OpenAlexFilters>(
    key: TKey,
    value: OpenAlexFilters[TKey],
  ) => void
}) {
  const activeCount = countActiveFilters(filters)

  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search OpenAlex"
            placeholder="Search papers, authors, or topics"
            value={searchDraft}
            onChange={(event) =>
              onSearchDraftChange(
                typeof event === 'string' ? event : event.currentTarget.value,
              )
            }
          />
          <InputGroupAddon align="inline-end" className="sm:pr-1">
            <InputGroupButton size="sm" type="submit" variant="default">
              Search
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FiltersPopover
          isOpen={filtersOpen}
          onOpenChange={setFiltersOpen}
          draft={draft}
          setDraft={setDraft}
          activeCount={activeCount}
          onOpen={onOpenFilters}
          onSortChange={onSortChange}
          onOpenAccessChange={onOpenAccessChange}
          onReset={onResetFilters}
          onApply={onApplyFilters}
        />
      </div>
      {activeCount > 0 ? (
        <FilterChips filters={filters} onRemove={onRemoveFilter} />
      ) : null}
    </form>
  )
}
