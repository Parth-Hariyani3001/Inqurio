import { lazy, Suspense, useEffect, useState } from 'react'
import { AlertCircle, Bookmark } from 'lucide-react'
import { useAuth } from '@clerk/tanstack-react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Sheet,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  annotationsQueryOptions,
  createAnnotation,
  DEFAULT_HIGHLIGHT_COLOR,
  DRAFT_ANNOTATION_ID,
  deleteAnnotation,
  updateAnnotation,
} from '#/lib/annotations.ts'
import type {
  AnnotationResponse,
  AnnotationSelection,
} from '#/lib/annotations.ts'

const PdfViewer = lazy(() =>
  import('#/components/chats/pdf-viewer.tsx').then((mod) => ({
    default: mod.PdfViewer,
  })),
)

export function PdfFolio({
  paperId,
  title,
}: {
  paperId: string
  title?: string
}) {
  const { isLoaded, getToken } = useAuth()
  const queryClient = useQueryClient()
  const [mounted, setMounted] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [color, setColor] = useState<string>(DEFAULT_HIGHLIGHT_COLOR)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [focusPage, setFocusPage] = useState<number | null>(null)
  const [focusRequest, setFocusRequest] = useState(0)
  const [draft, setDraft] = useState<AnnotationResponse | null>(null)
  const [marksOpen, setMarksOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    void getToken().then(setToken)
  }, [getToken, isLoaded])

  const annotationsQuery = useQuery(
    annotationsQueryOptions(paperId, getToken, isLoaded),
  )
  const annotations = annotationsQuery.data ?? []
  const overlayAnnotations = draft ? [...annotations, draft] : annotations
  const isDraft = activeId === DRAFT_ANNOTATION_ID
  const active = isDraft
    ? draft
    : (annotations.find((item) => item.uid === activeId) ?? null)

  useEffect(() => {
    if (isDraft) return
    setNote(active?.content ?? '')
  }, [active?.content, active?.uid, isDraft])

  useEffect(() => {
    setDraft((current) => {
      if (!current || current.color === color) return current
      return { ...current, color }
    })
  }, [color])

  const queryKey = ['papers', 'annotations', paperId] as const

  const createMutation = useMutation({
    mutationFn: (payload: { selection: AnnotationSelection; content: string }) =>
      createAnnotation(
        paperId,
        { color, selection: payload.selection, content: payload.content },
        getToken,
      ),
    onSuccess: (created) => {
      queryClient.setQueryData<Array<AnnotationResponse>>(
        queryKey,
        (current) => [...(current ?? []), created],
      )
      setDraft(null)
      setActiveId(created.uid)
      setNote(created.content)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save the highlight.',
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; content: string }) =>
      updateAnnotation(payload.id, { content: payload.content }, getToken),
    onSuccess: (updated) => {
      queryClient.setQueryData<Array<AnnotationResponse>>(queryKey, (current) =>
        (current ?? []).map((item) =>
          item.uid === updated.uid ? updated : item,
        ),
      )
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not save the note.',
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAnnotation(id, getToken),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Array<AnnotationResponse>>(queryKey, (current) =>
        (current ?? []).filter((item) => item.uid !== id),
      )
      if (activeId === id) setActiveId(null)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not remove the mark.',
      )
    },
  })

  function discardDraft() {
    setDraft(null)
    if (activeId === DRAFT_ANNOTATION_ID) setActiveId(null)
  }

  function saveDraft() {
    if (!draft) return
    createMutation.mutate({
      selection: draft.selection,
      content: note,
    })
  }

  function saveNote() {
    if (!active || isDraft || note === active.content) return
    updateMutation.mutate({ id: active.uid, content: note })
  }

  function handleActiveIdChange(id: string | null) {
    if (id !== DRAFT_ANNOTATION_ID) setDraft(null)
    setActiveId(id)
  }

  const marksButton = (
    <Button
      className="shrink-0"
      size="sm"
      variant="outline"
      onPress={() => setMarksOpen(true)}
    >
      <Bookmark data-icon="inline-start" />
      Saved
    </Button>
  )

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col bg-muted/40">
      {!mounted || !token ? (
        <>
          <div className="flex h-10 shrink-0 items-center border-b border-border bg-card px-3">
            <p className="truncate font-serif text-sm tracking-tight">
              {title ?? 'Paper'}
            </p>
          </div>
          <div className="h-full min-h-0 flex-1 p-3">
            <Skeleton className="size-full" />
          </div>
        </>
      ) : (
        <Suspense
          fallback={
            <div className="h-full min-h-0 flex-1 p-3">
              <Skeleton className="size-full" />
            </div>
          }
        >
          <PdfViewer
            paperId={paperId}
            token={token}
            annotations={overlayAnnotations}
            color={color}
            onColorChange={setColor}
            activeId={activeId}
            onActiveIdChange={handleActiveIdChange}
            onCreateFromSelection={(selection) => {
              setDraft({
                uid: DRAFT_ANNOTATION_ID,
                paper_id: paperId,
                content: '',
                selection,
                color,
                created_at: new Date().toISOString(),
                updated_at: null,
              })
              setActiveId(DRAFT_ANNOTATION_ID)
              setNote('')
            }}
            toolbarStart={
              <>
                <p className="min-w-0 flex-1 truncate font-serif text-sm tracking-tight">
                  {title ?? 'Paper'}
                </p>
                {marksButton}
              </>
            }
            focusPage={focusPage}
            focusRequest={focusRequest}
          />
        </Suspense>
      )}
      {active ? (
        <div className="absolute right-3 bottom-3 left-3 z-10 rounded-lg border border-border bg-popover p-3 shadow-md">
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="mark-note">
                {isDraft ? 'Unsaved mark' : 'Note'} · page{' '}
                {active.selection.pageNumber}
              </FieldLabel>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {active.selection.selectedText}
              </p>
              <Textarea
                id="mark-note"
                value={note}
                onChange={(event) => {
                  const next =
                    typeof event === 'string'
                      ? event
                      : event.currentTarget.value
                  setNote(next)
                }}
              />
            </Field>
            <div className="flex justify-end gap-2">
              {isDraft ? (
                <>
                  <Button variant="outline" onPress={discardDraft}>
                    Discard
                  </Button>
                  <Button
                    isDisabled={createMutation.isPending}
                    onPress={saveDraft}
                  >
                    {createMutation.isPending ? (
                      <Spinner data-icon="inline-start" />
                    ) : null}
                    Save mark
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="destructive"
                    isDisabled={deleteMutation.isPending}
                    onPress={() => deleteMutation.mutate(active.uid)}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    onPress={() => {
                      saveNote()
                      setActiveId(null)
                    }}
                  >
                    Done
                  </Button>
                </>
              )}
            </div>
          </FieldGroup>
        </div>
      ) : null}
      <Sheet isOpen={marksOpen} onOpenChange={setMarksOpen} side="right">
        <SheetHeader>
          <SheetTitle>Saved marks</SheetTitle>
        </SheetHeader>
        {annotations.length === 0 ? (
          <Empty className="min-h-40 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Bookmark />
              </EmptyMedia>
              <EmptyTitle>No marks yet</EmptyTitle>
              <EmptyDescription>
                Select text, then save the mark if you want to keep it.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-2 px-4 pb-4">
            {annotations.map((item) => (
              <Button
                key={item.uid}
                className="h-auto items-start justify-start py-2 text-left"
                variant="ghost"
                onPress={() => {
                  setActiveId(item.uid)
                  setFocusPage(item.selection.pageNumber)
                  setFocusRequest((current) => current + 1)
                  setMarksOpen(false)
                }}
              >
                <span
                  className="mt-1 block size-2.5 shrink-0 rounded-sm ring-1 ring-foreground/20"
                  style={{ backgroundColor: item.color }}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">
                    Page {item.selection.pageNumber}
                  </span>
                  <span className="truncate text-sm">
                    {item.content.trim() || item.selection.selectedText}
                  </span>
                </span>
              </Button>
            ))}
          </div>
        )}
      </Sheet>
      {annotationsQuery.isError ? (
        <Alert
          variant="destructive"
          className="absolute top-12 right-3 left-3 h-fit"
        >
          <AlertCircle />
          <AlertTitle>Could not load marks</AlertTitle>
          <AlertDescription>
            {annotationsQuery.error instanceof Error
              ? annotationsQuery.error.message
              : 'Saved highlights are unavailable.'}
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
