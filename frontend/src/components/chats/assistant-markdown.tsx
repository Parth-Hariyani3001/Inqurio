import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

import { cn } from '@/lib/utils'

export function AssistantMarkdown({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'text-sm leading-relaxed break-words',
        '[&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
        '[&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:font-serif [&_h1]:text-base [&_h1]:font-semibold',
        '[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:font-serif [&_h2]:text-sm [&_h2]:font-semibold',
        '[&_h3]:mb-1.5 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold',
        '[&_li]:my-0.5',
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-4',
        '[&_p]:my-2 [&_p]:first:mt-0 [&_p]:last:mb-0',
        '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs',
        '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
        '[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-4',
        className,
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </Markdown>
    </div>
  )
}
