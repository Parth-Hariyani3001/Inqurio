import type { Key, Selection } from 'react-aria-components'
import { SlidersHorizontal } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { OpenAlexFilters } from '#/lib/openalex.ts'
import { SORT_OPTIONS } from '#/lib/openalex.ts'
import { OPEN_ACCESS_OPTIONS } from '#/components/explore/filter-utils.ts'

export function FiltersPopover({
  isOpen,
  onOpenChange,
  draft,
  setDraft,
  activeCount,
  onOpen,
  onSortChange,
  onOpenAccessChange,
  onReset,
  onApply,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  draft: OpenAlexFilters
  setDraft: (
    value: OpenAlexFilters | ((current: OpenAlexFilters) => OpenAlexFilters),
  ) => void
  activeCount: number
  onOpen: () => void
  onSortChange: (key: Key | null) => void
  onOpenAccessChange: (selection: Selection) => void
  onReset: () => void
  onApply: () => void
}) {
  return (
    <PopoverTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button type="button" variant="outline" onPress={onOpen}>
        <SlidersHorizontal data-icon="inline-start" />
        Filters
        {activeCount > 0 ? (
          <Badge variant="secondary">{activeCount}</Badge>
        ) : null}
      </Button>
      <Popover className="w-80" placement="bottom end">
        <PopoverHeader>
          <PopoverTitle>Filters</PopoverTitle>
          <PopoverDescription>
            Narrow articles by access, year, and sort.
          </PopoverDescription>
        </PopoverHeader>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel>Open access</FieldLabel>
            <ToggleGroup
              className="w-full"
              selectedKeys={[draft.openAccess]}
              selectionMode="single"
              variant="outline"
              onSelectionChange={onOpenAccessChange}
            >
              {OPEN_ACCESS_OPTIONS.map((item) => (
                <ToggleGroupItem key={item.id} className="flex-1" id={item.id}>
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="from-year">From year</FieldLabel>
              <Input
                id="from-year"
                inputMode="numeric"
                placeholder="2018"
                value={draft.fromYear}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    fromYear:
                      typeof event === 'string'
                        ? event
                        : event.currentTarget.value,
                  }))
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="to-year">To year</FieldLabel>
              <Input
                id="to-year"
                inputMode="numeric"
                placeholder="2026"
                value={draft.toYear}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    toYear:
                      typeof event === 'string'
                        ? event
                        : event.currentTarget.value,
                  }))
                }
              />
            </Field>
          </div>
          <Field>
            <FieldLabel>Sort</FieldLabel>
            <Select
              className="w-full"
              placeholder="Relevance"
              selectedKey={draft.sort}
              onSelectionChange={onSortChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SORT_OPTIONS.map((item) => (
                    <SelectItem key={item.id} id={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onPress={onReset}>
            Reset
          </Button>
          <Button type="button" onPress={onApply}>
            Apply
          </Button>
        </div>
      </Popover>
    </PopoverTrigger>
  )
}
