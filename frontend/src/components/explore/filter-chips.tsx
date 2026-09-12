import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { OpenAlexFilters } from '#/lib/openalex.ts'
import { DEFAULT_OPENALEX_FILTERS } from '#/lib/openalex.ts'
import { openAccessLabel, sortLabel } from '#/components/explore/filter-utils.ts'

export function FilterChips({
  filters,
  onRemove,
}: {
  filters: OpenAlexFilters
  onRemove: <TKey extends keyof OpenAlexFilters>(
    key: TKey,
    value: OpenAlexFilters[TKey],
  ) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {filters.openAccess !== 'any' ? (
        <FilterChip
          label={`${openAccessLabel(filters.openAccess)} access`}
          onRemove={() => onRemove('openAccess', 'any')}
        />
      ) : null}
      {filters.fromYear.trim() ? (
        <FilterChip
          label={`From ${filters.fromYear}`}
          onRemove={() => onRemove('fromYear', '')}
        />
      ) : null}
      {filters.toYear.trim() ? (
        <FilterChip
          label={`To ${filters.toYear}`}
          onRemove={() => onRemove('toYear', '')}
        />
      ) : null}
      {filters.sort !== DEFAULT_OPENALEX_FILTERS.sort ? (
        <FilterChip
          label={sortLabel(filters.sort)}
          onRemove={() => onRemove('sort', DEFAULT_OPENALEX_FILTERS.sort)}
        />
      ) : null}
    </div>
  )
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string
  onRemove: () => void
}) {
  return (
    <Badge variant="secondary">
      {label}
      <Button
        aria-label={`Remove ${label}`}
        size="icon-xs"
        type="button"
        variant="ghost"
        onPress={onRemove}
      >
        <X />
      </Button>
    </Badge>
  )
}
