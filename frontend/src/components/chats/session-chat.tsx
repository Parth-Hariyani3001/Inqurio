import { useEffect, useState } from 'react'
import { ArrowUp, Copy, FileText } from 'lucide-react'
import { useAuth, useUser } from '@clerk/tanstack-react-start'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { toPlainAnswer } from '#/components/chats/answer-terms.ts'
import { AssistantMarkdown } from '#/components/chats/assistant-markdown.tsx'
import { MessageCitationsList } from '#/components/chats/message-citations.tsx'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import {
  parseMessageCitations,
  streamSessionMessage,
} from '#/lib/sessions.ts'
import type { MessageResponse } from '#/lib/sessions.ts'

type ChatMessage = MessageResponse & {
  pending?: boolean
  clientKey: string
}

function toChatMessages(msgs: Array<MessageResponse>): Array<ChatMessage> {
  return msgs.map((m) => ({ ...m, clientKey: m.uid }))
}

const SUGGESTIONS = [
  'What is the main claim?',
  'Summarize the method',
  'What are the limitations?',
  'Which results matter most?',
]

function sessionDayKey(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toDateString()
}

function formatDayMarker(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date)
}

function formatMessageTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  return new Intl.DateTimeFormat(undefined, {
    timeStyle: 'short',
  }).format(date)
}

function userInitials(name?: string | null, email?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  if (parts[0]) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return email?.slice(0, 2).toUpperCase() || 'You'
}

export function SessionChat({
  sessionId,
  messages,
  onShowPdf,
}: {
  sessionId: string
  messages: Array<MessageResponse>
  onShowPdf?: () => void
}) {
  const { getToken } = useAuth()
  const { user } = useUser()
  const queryClient = useQueryClient()

  const [draft, setDraft] = useState('')
  const [items, setItems] = useState<Array<ChatMessage>>(() =>
    toChatMessages(messages),
  )
  const [isSending, setIsSending] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const [phaseLabel, setPhaseLabel] = useState('Searching the paper…')

  useEffect(() => {
    if (isSending) return
    setItems((current) => {
      if (
        current.length === messages.length &&
        current.every((m, i) => m.uid === messages[i]?.uid)
      ) {
        return current
      }
      return toChatMessages(messages)
    })
  }, [messages, isSending])

  async function sendMessage(nextContent?: string) {
    const content = (nextContent ?? draft).trim()
    if (!content || isSending) return

    const optimisticUserId = `local-user-${crypto.randomUUID()}`
    const optimisticAssistantId = `local-assistant-${crypto.randomUUID()}`

    setDraft('')
    setIsSending(true)
    setStreamingId(optimisticAssistantId)
    setPhaseLabel('Searching the paper…')
    setItems((current) => [
      ...current,
      {
        uid: optimisticUserId,
        clientKey: optimisticUserId,
        content,
        role: 'user',
        citations: {},
        created_at: new Date().toISOString(),
        pending: true,
      },
      {
        uid: optimisticAssistantId,
        clientKey: optimisticAssistantId,
        content: '',
        role: 'assistant',
        citations: {},
        created_at: new Date().toISOString(),
        pending: true,
      },
    ])

    try {
      await streamSessionMessage(sessionId, content, getToken, {
        onUserMessage: (message) => {
          setItems((current) =>
            current.map((item) =>
              item.clientKey === optimisticUserId
                ? { ...message, pending: false, clientKey: item.clientKey }
                : item,
            ),
          )
        },
        onPhase: (phase, label) => {
          if (phase === 'writing') {
            setPhaseLabel('')
            return
          }
          setPhaseLabel(label)
        },
        onAssistantDelta: (delta) => {
          setPhaseLabel('')
          setItems((current) =>
            current.map((item) =>
              item.clientKey === optimisticAssistantId
                ? { ...item, content: `${item.content}${delta}` }
                : item,
            ),
          )
        },
        onAssistantDone: (message) => {
          setPhaseLabel('')
          setItems((current) =>
            current.map((item) =>
              item.clientKey === optimisticAssistantId
                ? { ...message, pending: false, clientKey: item.clientKey }
                : item,
            ),
          )
        },
        onError: (detail) => {
          toast.error(detail)
          setPhaseLabel('')
          setItems((current) =>
            current.filter(
              (item) =>
                item.clientKey !== optimisticUserId &&
                item.clientKey !== optimisticAssistantId,
            ),
          )
        },
      })

      await queryClient.invalidateQueries({
        queryKey: ['sessions', 'detail', sessionId],
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send message'
      toast.error(message)
      setItems((current) =>
        current.filter(
          (item) =>
            item.clientKey !== optimisticUserId &&
            item.clientKey !== optimisticAssistantId,
        ),
      )
    } finally {
      setIsSending(false)
      setStreamingId(null)
      setPhaseLabel('Searching the paper…')
    }
  }

  async function copyMessage(content: string) {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  const displayName = user?.fullName || user?.firstName
  const initials = userInitials(displayName, user?.primaryEmailAddress?.emailAddress)

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden border-border bg-background md:border-l">
      <div className="flex h-11 shrink-0 items-center border-b border-border bg-card px-3">
        {onShowPdf ? (
          <Button
            className="ml-auto"
            size="sm"
            variant="outline"
            onPress={onShowPdf}
          >
            <FileText data-icon="inline-start" />
            Show PDF
          </Button>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <MessageScrollerProvider autoScroll defaultScrollPosition="end">
            <MessageScroller className="h-full">
              <MessageScrollerViewport>
                <MessageScrollerContent className="mx-auto w-full max-w-4xl gap-5 px-4 py-5">
                  {items.length === 0 ? (
                    <MessageScrollerItem messageId="empty">
                      <Empty className="border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <FileText />
                          </EmptyMedia>
                          <EmptyTitle>Ask this paper</EmptyTitle>
                          <EmptyDescription>
                            Questions live in this margin. The agent can search
                            the PDF and the web when needed.
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          {SUGGESTIONS.map((suggestion) => (
                            <Button
                              key={suggestion}
                              isDisabled={isSending}
                              size="sm"
                              variant="outline"
                              className="w-full hover:border-highlight hover:bg-highlight/35 hover:text-highlight-foreground"
                              onPress={() => {
                                void sendMessage(suggestion)
                              }}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </EmptyContent>
                      </Empty>
                    </MessageScrollerItem>
                  ) : (
                    items.map((message, index) => {
                      const isUser = message.role === 'user'
                      const citations = parseMessageCitations(message.citations)
                      const isStreaming =
                        message.clientKey === streamingId &&
                        message.content === ''
                      const showDayMarker =
                        index === 0 ||
                        sessionDayKey(message.created_at) !==
                          sessionDayKey(items[index - 1]!.created_at)

                      const isEnteringAssistant =
                        !isUser && message.clientKey === streamingId

                      return (
                        <MessageScrollerItem
                          key={message.clientKey}
                          messageId={message.uid}
                        >
                          <div
                            className={cn(
                              'flex flex-col gap-5',
                              isEnteringAssistant && 'chat-enter animate-chat-enter',
                            )}
                          >
                            {showDayMarker ? (
                              <Marker variant="separator">
                                <MarkerContent>
                                  {formatDayMarker(message.created_at)}
                                </MarkerContent>
                              </Marker>
                            ) : null}

                            {isStreaming ? (
                              <Message align="start">
                                <Marker role="status">
                                  <MarkerIcon>
                                    <Spinner />
                                  </MarkerIcon>
                                  <MarkerContent className="shimmer">
                                    {phaseLabel || 'Searching the paper…'}
                                  </MarkerContent>
                                </Marker>
                              </Message>
                            ) : (
                              <Message align={isUser ? 'end' : 'start'}>
                                <MessageAvatar>
                                  {isUser ? (
                                    <Avatar size="sm">
                                      {user?.imageUrl ? (
                                        <AvatarImage
                                          alt={displayName ?? 'You'}
                                          src={user.imageUrl}
                                        />
                                      ) : null}
                                      <AvatarFallback>{initials}</AvatarFallback>
                                    </Avatar>
                                  ) : (
                                    <Avatar size="sm">
                                      <AvatarFallback className="font-display">
                                        In
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                </MessageAvatar>
                                <MessageContent
                                  className={
                                    isUser
                                      ? undefined
                                      : 'border-l border-border pl-3'
                                  }
                                >
                                  <Bubble
                                    align={isUser ? 'end' : 'start'}
                                    variant={isUser ? 'tinted' : 'ghost'}
                                  >
                                    <BubbleContent>
                                      {isUser ? (
                                        message.content
                                      ) : (
                                        <AssistantMarkdown
                                          content={message.content}
                                          isStreaming={
                                            message.clientKey === streamingId
                                          }
                                        />
                                      )}
                                    </BubbleContent>
                                  </Bubble>
                                  <MessageFooter className="gap-1">
                                    {formatMessageTime(message.created_at)}
                                    {!isUser && message.content ? (
                                      <Button
                                        aria-label="Copy answer"
                                        size="icon-xs"
                                        variant="ghost"
                                        onPress={() => {
                                          void copyMessage(toPlainAnswer(message.content))
                                        }}
                                      >
                                        <Copy />
                                      </Button>
                                    ) : null}
                                  </MessageFooter>
                                  {!isUser && citations ? (
                                    <MessageCitationsList
                                      citations={citations}
                                    />
                                  ) : null}
                                </MessageContent>
                              </Message>
                            )}
                          </div>
                        </MessageScrollerItem>
                      )
                    })
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        </div>
        <div className="shrink-0 border-t border-border bg-card px-4 py-3">
          <Field
            className="mx-auto w-full max-w-4xl"
            data-disabled={isSending ? true : undefined}
          >
            <InputGroup isDisabled={isSending}>
              <InputGroupTextarea
                disabled={isSending}
                placeholder="Ask this paper…"
                rows={3}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void sendMessage()
                  }
                }}
              />
              <InputGroupAddon align="block-end" className="justify-between">
                <InputGroupText>Enter to send</InputGroupText>
                <InputGroupButton
                  aria-label="Send"
                  isDisabled={isSending || !draft.trim()}
                  size="sm"
                  variant="default"
                  onPress={() => {
                    void sendMessage()
                  }}
                >
                  {isSending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <ArrowUp data-icon="inline-start" />
                  )}
                  Send
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </div>
      </div>
    </section>
  )
}
