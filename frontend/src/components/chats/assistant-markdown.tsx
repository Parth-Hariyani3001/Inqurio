'use client'

import { useCallback, useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize, {
  defaultSchema,
  type Options as SanitizeSchema,
} from 'rehype-sanitize'
import { Download, Maximize2, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const katexSanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), 'className', 'style'],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      'className',
      'style',
      'ariaHidden',
    ],
    math: ['className', 'display', 'xmlns'],
    annotation: ['encoding'],
    mi: ['mathvariant'],
    mo: ['stretchy', 'fence', 'separator', 'form'],
    mn: ['mathvariant'],
    mtext: ['mathvariant'],
    mspace: ['width', 'height', 'depth', 'linebreak'],
    mfrac: ['linethickness'],
    mstyle: ['mathvariant', 'scriptlevel', 'displaystyle'],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'math',
    'semantics',
    'mrow',
    'mi',
    'mo',
    'mn',
    'msup',
    'msub',
    'msubsup',
    'mfrac',
    'msqrt',
    'mroot',
    'mtext',
    'annotation',
    'mover',
    'munder',
    'munderover',
    'mtable',
    'mtr',
    'mtd',
    'mspace',
    'menclose',
    'mstyle',
    'mpadded',
    'mphantom',
  ],
}

type ColorScheme = 'dark' | 'light'

type DiagramTheme = {
  nodeFill: string
  nodeStroke: string
  nodeText: string
  edge: string
  edgeText: string
}

function readResolvedScheme(): ColorScheme {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function useResolvedScheme(): ColorScheme {
  const [scheme, setScheme] = useState<ColorScheme>(readResolvedScheme)

  useEffect(() => {
    const root = document.documentElement
    const update = () => setScheme(readResolvedScheme())
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return scheme
}

function readThemeBackground(): string {
  const probe = document.createElement('div')
  probe.className = 'bg-background'
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const fill = getComputedStyle(probe).backgroundColor
  probe.remove()
  return fill || (readResolvedScheme() === 'dark' ? '#111827' : '#ffffff')
}

function diagramTheme(scheme: ColorScheme): DiagramTheme {
  // Soft Mermaid-like flowchart boxes (rounded rects, muted fills).
  if (scheme === 'dark') {
    return {
      nodeFill: '#1E293B',
      nodeStroke: '#7DD3FC',
      nodeText: '#F1F5F9',
      edge: '#94A3B8',
      edgeText: '#CBD5E1',
    }
  }
  return {
    nodeFill: '#EEF6FF',
    nodeStroke: '#3B82F6',
    nodeText: '#0F172A',
    edge: '#64748B',
    edgeText: '#334155',
  }
}

/** Strip LLM color/shape overrides so UI theme + rounded boxes always win. */
function sanitizeDotSource(source: string): string {
  return source
    .replace(/\bshape\s*=\s*"?(?:circle|ellipse|oval|doublecircle|point)"?/gi, 'shape=box')
    .replace(/\bfillcolor\s*=\s*"[^"]*"/gi, '')
    .replace(/\bfillcolor\s*=\s*[^\s,\];]+/gi, '')
    .replace(/\bfontcolor\s*=\s*"[^"]*"/gi, '')
    .replace(/\bfontcolor\s*=\s*[^\s,\];]+/gi, '')
    .replace(/\bbgcolor\s*=\s*"[^"]*"/gi, '')
    .replace(/\bbgcolor\s*=\s*[^\s,\];]+/gi, '')
    .replace(/\bcolor\s*=\s*"[^"]*"/gi, '')
    .replace(/\bcolor\s*=\s*[^\s,\];]+/gi, '')
    .replace(/\bstyle\s*=\s*"[^"]*"/gi, '')
    .replace(/\bstyle\s*=\s*[^\s,\];]+/gi, '')
}

function withDiagramTheme(source: string, scheme: ColorScheme): string {
  const theme = diagramTheme(scheme)
  const defaults = `
  bgcolor="transparent";
  pad="0.2";
  nodesep="0.35";
  ranksep="0.45";
  size="5,3.5";
  ratio="compress";
  fontname="Helvetica";
  node [
    shape=box,
    style="rounded,filled",
    fillcolor="${theme.nodeFill}",
    color="${theme.nodeStroke}",
    fontcolor="${theme.nodeText}",
    fontname="Helvetica",
    fontsize="12",
    margin="0.2,0.1",
    penwidth="1.4",
    width="0",
    height="0"
  ];
  edge [
    color="${theme.edge}",
    fontcolor="${theme.edgeText}",
    fontname="Helvetica",
    fontsize="10",
    arrowsize="0.65",
    penwidth="1.25"
  ];
`
  const cleaned = sanitizeDotSource(source.trim())
  const brace = cleaned.indexOf('{')
  if (brace === -1) return cleaned
  return `${cleaned.slice(0, brace + 1)}\n${defaults}${cleaned.slice(brace + 1)}`
}

type VizInstance = Awaited<ReturnType<typeof import('@viz-js/viz').instance>>

let vizPromise: Promise<VizInstance> | null = null

async function getViz(): Promise<VizInstance> {
  if (!vizPromise) {
    vizPromise = import('@viz-js/viz')
      .then((mod) => mod.instance())
      .catch((error) => {
        // Drop the cached rejection so a later attempt can succeed after Vite
        // finishes (re)optimizing the dep.
        vizPromise = null
        throw error
      })
  }
  return vizPromise
}

async function renderDotSvg(source: string, scheme: ColorScheme): Promise<string> {
  const viz = await getViz()
  const themed = withDiagramTheme(source, scheme)
  // renderString avoids DOMParser (renderSVGElement), which can fail on & in labels.
  return viz.renderString(themed, { format: 'svg', engine: 'dot' })
}

function looksLikeDot(source: string): boolean {
  return /^\s*(?:strict\s+)?(?:di)?graph\b/i.test(source)
}

function isDotSourceComplete(source: string): boolean {
  if (!looksLikeDot(source)) return false
  let depth = 0
  for (const ch of source) {
    if (ch === '{') depth += 1
    else if (ch === '}') depth -= 1
    if (depth < 0) return false
  }
  return depth === 0 && source.includes('{')
}

function isDotFence(
  language: string | undefined,
  source: string,
  isBlock: boolean,
): boolean {
  if (!isBlock) return false
  const lang = language?.toLowerCase()
  if (lang === 'dot' || lang === 'graphviz' || lang === 'gv') return true
  // Models often omit the language or use text/plaintext for digraphs.
  if (looksLikeDot(source)) {
    return !lang || lang === 'text' || lang === 'plaintext' || lang === 'txt'
  }
  return false
}

function readSvgViewBox(svg: string): { width: number; height: number } | null {
  const match = /viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.]+)\s+([\d.]+)["']/.exec(
    svg,
  )
  if (!match) return null
  const width = Number(match[3])
  const height = Number(match[4])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  return { width, height }
}

function prepareSvgForDisplay(svg: string): string {
  // Drop XML prolog / doctype — not needed inside HTML.
  const cleaned = svg
    .replace(/<\?xml[\s\S]*?\?>/i, '')
    .replace(/<!DOCTYPE[\s\S]*?>/i, '')
    .trim()

  const size = readSvgViewBox(cleaned)

  return cleaned.replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
    let nextAttrs = String(attrs)
      .replace(/\s(?:width|height)="[^"]*"/gi, '')
      .replace(/\spreserveAspectRatio="[^"]*"/gi, '')

    const styleMatch = nextAttrs.match(/\sstyle="([^"]*)"/i)
    const keptStyle = (styleMatch?.[1] ?? '')
      .split(';')
      .map((part) => part.trim())
      .filter(
        (part) =>
          part && !/^(max-width|width|height|aspect-ratio)\s*:/i.test(part),
      )
      .join(';')

    const sizing = size
      ? `display:block;width:auto;max-width:100%;height:auto;aspect-ratio:${size.width}/${size.height};margin-inline:auto`
      : 'display:block;width:auto;max-width:100%;height:auto;margin-inline:auto'
    const style = keptStyle ? `${sizing};${keptStyle}` : sizing

    if (styleMatch) {
      nextAttrs = nextAttrs.replace(/\sstyle="[^"]*"/i, ` style="${style}"`)
    } else {
      nextAttrs += ` style="${style}"`
    }

    return `<svg preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"${nextAttrs}>`
  })
}

function prepareSvgForExport(svg: string, background: string): string {
  const size = readSvgViewBox(svg)
  let next = svg
    .replace(/<\?xml[\s\S]*?\?>/i, '')
    .replace(/<!DOCTYPE[\s\S]*?>/i, '')
    .replace(/<svg\b([^>]*)>/i, (_, attrs: string) => {
      let nextAttrs = String(attrs)
        .replace(/\s(?:width|height)="[^"]*"/gi, '')
        .replace(/\sxmlns="[^"]*"/gi, '')

      if (size) {
        nextAttrs += ` width="${size.width}" height="${size.height}"`
      }

      const styleMatch = nextAttrs.match(/\sstyle="([^"]*)"/i)
      if (styleMatch) {
        const keptStyle = styleMatch[1]
          .split(';')
          .map((part) => part.trim())
          .filter(
            (part) =>
              part &&
              !/^(max-width|width|height|aspect-ratio)\s*:/i.test(part),
          )
          .join(';')
        nextAttrs = nextAttrs.replace(
          /\sstyle="[^"]*"/i,
          keptStyle ? ` style="${keptStyle}"` : '',
        )
      }

      return `<svg xmlns="http://www.w3.org/2000/svg"${nextAttrs}>`
    })

  if (!/<rect[^>]*width=["']100%["'][^>]*height=["']100%["']/i.test(next)) {
    next = next.replace(
      /(<svg\b[^>]*>)/,
      `$1<rect width="100%" height="100%" fill="${background}"/>`,
    )
  }

  return next
}

async function downloadSvgAsPng(svg: string, filename: string) {
  const background = readThemeBackground()
  const exportSvg = prepareSvgForExport(svg, background)
  const size = readSvgViewBox(exportSvg) ?? { width: 800, height: 600 }
  const scale = 2

  const blob = new Blob([exportSvg], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to decode diagram SVG'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(size.width * scale))
    canvas.height = Math.max(1, Math.round(size.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')

    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    )
    if (!pngBlob) throw new Error('PNG encode failed')

    const pngUrl = URL.createObjectURL(pngBlob)
    const anchor = document.createElement('a')
    anchor.href = pngUrl
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(pngUrl)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function DiagramToolbar({
  onExpand,
  onDownload,
  downloading,
}: {
  onExpand: () => void
  onDownload: () => void
  downloading?: boolean
}) {
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border border-border/60 bg-background/90 p-0.5 shadow-sm backdrop-blur-sm">
      <Button
        aria-label="Expand diagram"
        size="icon-xs"
        variant="ghost"
        onPress={onExpand}
      >
        <Maximize2 />
      </Button>
      <Button
        aria-label="Download diagram as PNG"
        isDisabled={downloading}
        size="icon-xs"
        variant="ghost"
        onPress={onDownload}
      >
        <Download />
      </Button>
    </div>
  )
}

function DiagramCanvas({
  svg,
  className,
}: {
  svg: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'diagram-canvas rounded-md bg-background text-foreground',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function DotBlock({
  source,
  isStreaming,
}: {
  source: string
  isStreaming?: boolean
}) {
  const scheme = useResolvedScheme()
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    // While streaming, wait until braces are balanced so we don't flash errors.
    if (isStreaming && !isDotSourceComplete(source)) {
      setSvg(null)
      setFailed(false)
      return
    }

    let cancelled = false

    async function renderDiagram() {
      try {
        const rendered = await renderDotSvg(source, scheme)
        if (cancelled) return
        setSvg(rendered)
        setFailed(false)
      } catch (error) {
        console.error('DOT diagram render failed', error)
        if (!cancelled) {
          setSvg(null)
          setFailed(true)
        }
      }
    }

    void renderDiagram()
    return () => {
      cancelled = true
    }
  }, [source, isStreaming, scheme])

  const handleDownload = useCallback(async () => {
    if (!svg) return
    setDownloading(true)
    try {
      await downloadSvgAsPng(svg, `inquiro-diagram-${Date.now()}.png`)
      toast.success('Diagram downloaded')
    } catch {
      toast.error('Could not download diagram')
    } finally {
      setDownloading(false)
    }
  }, [svg])

  if (isStreaming && !isDotSourceComplete(source)) {
    return (
      <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3">
        <code className="language-dot bg-transparent p-0 font-mono text-[0.85em]">
          {source}
        </code>
      </pre>
    )
  }

  if (failed) {
    return (
      <pre className="my-2 overflow-x-auto rounded-md bg-muted p-3">
        <code className="language-dot bg-transparent p-0 font-mono text-[0.85em]">
          {source}
        </code>
      </pre>
    )
  }

  if (!svg) {
    return (
      <div className="my-2 flex min-h-32 items-center justify-center rounded-lg border border-border bg-background text-sm text-muted-foreground">
        Rendering diagram…
      </div>
    )
  }

  return (
    <>
      <div className="group relative my-2 overflow-hidden rounded-lg border border-border bg-background">
        <DiagramToolbar
          downloading={downloading}
          onDownload={() => {
            void handleDownload()
          }}
          onExpand={() => setExpanded(true)}
        />
        <DiagramCanvas
          className="max-h-[min(22rem,55vh)] overflow-auto p-4"
          svg={prepareSvgForDisplay(svg)}
        />
      </div>

      <Dialog
        className="items-start sm:max-w-[min(96vw,72rem)]"
        isOpen={expanded}
        onOpenChange={setExpanded}
      >
        <DialogHeader className="pr-10">
          <DialogTitle>Diagram</DialogTitle>
        </DialogHeader>
        <div className="relative -mx-1 max-h-[min(80vh,56rem)] w-full self-start overflow-auto rounded-lg border border-border">
          <div className="absolute top-2 right-2 z-10 flex gap-1 rounded-md border border-border/60 bg-background/90 p-0.5 shadow-sm backdrop-blur-sm">
            <Button
              aria-label="Download diagram as PNG"
              isDisabled={downloading}
              size="icon-xs"
              variant="ghost"
              onPress={() => {
                void handleDownload()
              }}
            >
              <Download />
            </Button>
            <DialogClose aria-label="Close" size="icon-xs" variant="ghost">
              <XIcon />
            </DialogClose>
          </div>
          <DiagramCanvas
            className="diagram-canvas-expanded p-6"
            svg={prepareSvgForDisplay(svg)}
          />
        </div>
      </Dialog>
    </>
  )
}

function MarkdownCode({
  className,
  children,
  isStreaming,
  ...props
}: React.ComponentProps<'code'> & { isStreaming?: boolean }) {
  const text = String(children).replace(/\n$/, '')
  const language = /language-([\w-]+)/i.exec(className || '')?.[1]
  const isBlock = Boolean(className) || text.includes('\n')

  if (isDotFence(language, text, isBlock)) {
    return <DotBlock isStreaming={isStreaming} source={text} />
  }

  if (isBlock) {
    return (
      <pre>
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    )
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  )
}

export function AssistantMarkdown({
  content,
  className,
  isStreaming = false,
}: {
  content: string
  className?: string
  isStreaming?: boolean
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
        '[&_.katex]:text-[1.05em] [&_.katex]:text-inherit',
        '[&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden',
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
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [rehypeKatex, { throwOnError: false }],
          [rehypeSanitize, katexSanitizeSchema],
        ]}
        components={{
          code: (props) => (
            <MarkdownCode {...props} isStreaming={isStreaming} />
          ),
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
