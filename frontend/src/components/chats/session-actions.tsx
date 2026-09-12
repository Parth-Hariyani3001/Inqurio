import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '@clerk/tanstack-react-start'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { deleteSession, updateSessionTitle } from '#/lib/sessions.ts'

export function SessionActions({
  sessionId,
  title,
}: {
  sessionId: string
  title: string
}) {
  const { getToken } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)

  const renameMutation = useMutation({
    mutationFn: (nextTitle: string) =>
      updateSessionTitle(sessionId, nextTitle, getToken),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('Chat renamed.')
      setRenameOpen(false)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not rename chat.',
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSession(sessionId, getToken),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('Chat deleted.')
      setDeleteOpen(false)
      if (pathname === `/dashboard/chats/${sessionId}`) {
        void navigate({ to: '/dashboard/chats' })
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not delete chat.',
      )
    },
  })

  const trimmedTitle = draftTitle.trim()
  const renameDisabled =
    renameMutation.isPending ||
    trimmedTitle.length === 0 ||
    trimmedTitle === title.trim()

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Chat actions"
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" collisionPadding={8}>
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={() => {
                setDraftTitle(title)
                setRenameOpen(true)
              }}
            >
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        isOpen={renameOpen}
        onOpenChange={(open) => {
          if (renameMutation.isPending) return
          setRenameOpen(open)
          if (open) setDraftTitle(title)
        }}
      >
        <DialogHeader>
          <DialogTitle>Rename chat</DialogTitle>
          <DialogDescription>
            Choose a short title for this conversation.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (renameDisabled) return
            renameMutation.mutate(trimmedTitle)
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`rename-session-${sessionId}`}>
                Title
              </FieldLabel>
              <Input
                autoFocus
                id={`rename-session-${sessionId}`}
                maxLength={200}
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose isDisabled={renameMutation.isPending}>
              Cancel
            </DialogClose>
            <Button isDisabled={renameDisabled} type="submit">
              {renameMutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <Dialog
        isOpen={deleteOpen}
        onOpenChange={(open) => {
          if (deleteMutation.isPending) return
          setDeleteOpen(open)
        }}
      >
        <DialogHeader>
          <DialogTitle>Delete chat</DialogTitle>
          <DialogDescription>
            This permanently deletes &ldquo;{title}&rdquo; and its messages.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose isDisabled={deleteMutation.isPending}>Cancel</DialogClose>
          <Button
            isDisabled={deleteMutation.isPending}
            type="button"
            variant="destructive"
            onPress={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : null}
            Delete
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
