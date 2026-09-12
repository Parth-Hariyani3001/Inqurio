import { MessageSquare, Send } from 'lucide-react'

import { Bubble, BubbleContent } from '@/components/ui/bubble'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldDescription } from '@/components/ui/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import {
  Message,
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
import {
  citationLines,
  formatSessionDate,
  type MessageResponse,
} from '#/lib/sessions.ts'

export function SessionChat({ messages }: { messages: Array<MessageResponse> }) {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col border-border bg-background md:border-l">
      <div className="flex h-10 shrink-0 items-center border-b border-border px-3">
        <p className="text-muted-foreground text-xs tracking-wide">Margin</p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <MessageScrollerProvider defaultScrollPosition="last-anchor">
            <MessageScroller className="h-full">
              <MessageScrollerViewport>
                <MessageScrollerContent className="gap-4 px-3 py-4">
                  {messages.length === 0 ? (
                    <MessageScrollerItem messageId="empty">
                      <Empty className="border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <MessageSquare />
                          </EmptyMedia>
                          <EmptyTitle>No messages in this chat</EmptyTitle>
                          <EmptyDescription>
                            Asking is not available yet. When it is, questions
                            you type here will stay next to the paper.
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </MessageScrollerItem>
                  ) : (
                    messages.map((message) => {
                      const isUser = message.role === 'user'
                      const citations = citationLines(message.citations)

                      return (
                        <MessageScrollerItem
                          key={message.uid}
                          messageId={message.uid}
                          scrollAnchor={isUser}
                        >
                          <Message align={isUser ? 'end' : 'start'}>
                            <MessageContent>
                              <Bubble
                                variant={isUser ? 'default' : 'secondary'}
                              >
                                <BubbleContent>{message.content}</BubbleContent>
                              </Bubble>
                              <MessageFooter>
                                {formatSessionDate(message.created_at)}
                              </MessageFooter>
                              {citations ? (
                                <p className="text-muted-foreground text-xs">
                                  {citations.join(' · ')}
                                </p>
                              ) : null}
                            </MessageContent>
                          </Message>
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
        <div className="shrink-0 border-t border-border p-3">
          <Field data-disabled>
            <InputGroup isDisabled>
              <InputGroupTextarea
                placeholder="Ask about this paper"
                rows={2}
              />
              <InputGroupAddon align="block-end">
                <InputGroupButton
                  aria-label="Send"
                  isDisabled
                  size="icon-xs"
                  variant="ghost"
                >
                  <Send />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              Asking questions is not available yet.
            </FieldDescription>
          </Field>
        </div>
      </div>
    </section>
  )
}
