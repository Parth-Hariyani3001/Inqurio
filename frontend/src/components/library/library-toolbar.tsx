import type { FormEvent } from 'react'
import { Search } from 'lucide-react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'

export function LibraryToolbar({
  searchDraft,
  onSubmit,
  onSearchDraftChange,
}: {
  searchDraft: string
  onSubmit: (event?: FormEvent) => void
  onSearchDraftChange: (value: string) => void
}) {
  return (
    <form className="flex flex-col gap-3" onSubmit={onSubmit}>
      <InputGroup>
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search your papers"
          placeholder="Search titles or authors"
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
    </form>
  )
}
