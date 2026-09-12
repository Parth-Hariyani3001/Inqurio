import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Minus,
  PanelLeftClose,
  Plus,
  Scan,
} from 'lucide-react'

import '#/components/chats/pdf-viewer.css'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getPageMetrics, loadPaperPdf, TextLayer } from '#/lib/pdf.ts'
import type { PageMetrics, PDFDocumentProxy, RenderTask } from '#/lib/pdf.ts'
import { cn } from '@/lib/utils'

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.15
const NEARBY_PAGES = 2
const MIN_OUTPUT_SCALE = 2
const MAX_CANVAS_PIXELS = 16_777_216

function FolioTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipTrigger>
      {children}
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  )
}

export function PdfViewer({
  paperId,
  token,
  title,
  onHide,
}: {
  paperId: string
  token: string
  title?: string
  onHide?: () => void
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [metrics, setMetrics] = useState<Array<PageMetrics>>([])
  const [scale, setScale] = useState<number | null>(null)
  const [fitWidthScale, setFitWidthScale] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notReady, setNotReady] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const pageEls = useRef(new Map<number, HTMLElement>())
  const followFitRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    let loaded: PDFDocumentProxy | null = null

    async function load() {
      setLoadError(null)
      setNotReady(false)
      try {
        loaded = await loadPaperPdf(paperId, token)
        const nextMetrics = await getPageMetrics(loaded)
        if (cancelled) {
          await loaded.destroy()
          return
        }
        setPdf(loaded)
        setMetrics(nextMetrics)
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : ''
        if (message.includes('404') || message.includes('Missing PDF')) {
          setNotReady(true)
          return
        }
        setLoadError(message || 'The PDF could not be loaded.')
      }
    }

    void load()

    return () => {
      cancelled = true
      void loaded?.destroy()
    }
  }, [paperId, token])

  useEffect(() => {
    followFitRef.current = true
    setScale(null)
    setFitWidthScale(1)
    setCurrentPage(1)
    setVisiblePages(new Set([1]))
  }, [paperId])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || !metrics[0]) return

    let timer: number | undefined

    const updateFit = () => {
      const width = scroller.clientWidth
      if (width <= 0) return
      const next = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, (width - 24) / metrics[0].width),
      )
      setFitWidthScale(next)
      if (!followFitRef.current) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        setScale(next)
      }, 50)
    }

    updateFit()
    const observer = new ResizeObserver(updateFit)
    observer.observe(scroller)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [metrics])

  function scrollToPage(pageNumber: number) {
    pageEls.current.get(pageNumber)?.scrollIntoView({ block: 'start' })
    setCurrentPage(pageNumber)
  }

  function onPageVisible(pageNumber: number, ratio: number) {
    setVisiblePages((current) => {
      const next = new Set(current)
      if (ratio > 0) next.add(pageNumber)
      else next.delete(pageNumber)
      return next
    })
    if (ratio > 0.35) setCurrentPage(pageNumber)
  }

  const pageCount = pdf?.numPages ?? 0

  if (notReady) {
    return (
      <Alert className="m-3 h-fit">
        <AlertCircle />
        <AlertTitle>This paper is not ready to read</AlertTitle>
        <AlertDescription>
          Wait until parsing finishes, then open the chat again.
        </AlertDescription>
      </Alert>
    )
  }

  if (loadError) {
    return (
      <Alert variant="destructive" className="m-3 h-fit">
        <AlertCircle />
        <AlertTitle>Could not open the PDF</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    )
  }

  if (!pdf || !metrics.length) {
    return <Skeleton className="m-3 size-full min-h-64" />
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-11 min-w-0 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <p className="min-w-0 flex-1 truncate font-serif text-sm tracking-tight">
          {title ?? 'Paper'}
        </p>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1">
          <FolioTip label="Previous page">
            <Button
              aria-label="Previous page"
              size="icon-sm"
              variant="ghost"
              isDisabled={currentPage <= 1}
              onPress={() => scrollToPage(Math.max(1, currentPage - 1))}
            >
              <ChevronLeft />
            </Button>
          </FolioTip>
          <p className="min-w-14 text-center text-xs tabular-nums text-muted-foreground">
            {currentPage} / {pageCount}
          </p>
          <FolioTip label="Next page">
            <Button
              aria-label="Next page"
              size="icon-sm"
              variant="ghost"
              isDisabled={currentPage >= pageCount}
              onPress={() => scrollToPage(Math.min(pageCount, currentPage + 1))}
            >
              <ChevronRight />
            </Button>
          </FolioTip>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <FolioTip label="Zoom out">
            <Button
              aria-label="Zoom out"
              size="icon-sm"
              variant="ghost"
              isDisabled={scale == null || scale <= MIN_SCALE}
              onPress={() => {
                followFitRef.current = false
                setScale((current) =>
                  Math.max(MIN_SCALE, (current ?? fitWidthScale) - SCALE_STEP),
                )
              }}
            >
              <Minus />
            </Button>
          </FolioTip>
          <FolioTip label="Fit width">
            <Button
              aria-label="Fit width"
              size="icon-sm"
              variant="ghost"
              onPress={() => {
                followFitRef.current = true
                setScale(fitWidthScale)
              }}
            >
              <Scan />
            </Button>
          </FolioTip>
          <FolioTip label="Zoom in">
            <Button
              aria-label="Zoom in"
              size="icon-sm"
              variant="ghost"
              isDisabled={scale == null || scale >= MAX_SCALE}
              onPress={() => {
                followFitRef.current = false
                setScale((current) =>
                  Math.min(MAX_SCALE, (current ?? fitWidthScale) + SCALE_STEP),
                )
              }}
            >
              <Plus />
            </Button>
          </FolioTip>
          {onHide ? (
            <FolioTip label="Hide PDF">
              <Button
                aria-label="Hide PDF"
                size="icon-sm"
                variant="ghost"
                onPress={onHide}
              >
                <PanelLeftClose />
              </Button>
            </FolioTip>
          ) : null}
        </div>
      </div>
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-auto bg-muted p-3"
      >
        {scale == null ? (
          <Skeleton className="size-full min-h-64" />
        ) : (
          <div className="flex flex-col gap-3">
            {metrics.map((page, index) => {
              const pageNumber = index + 1
              const shouldPaint = [...visiblePages].some(
                (visible) => Math.abs(visible - pageNumber) <= NEARBY_PAGES,
              )
              return (
                <PdfPage
                  key={pageNumber}
                  pdf={pdf}
                  pageNumber={pageNumber}
                  metrics={page}
                  scale={scale}
                  paint={shouldPaint}
                  pageEls={pageEls.current}
                  onVisible={onPageVisible}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function PdfPage({
  pdf,
  pageNumber,
  metrics,
  scale,
  paint,
  pageEls,
  onVisible,
}: {
  pdf: PDFDocumentProxy
  pageNumber: number
  metrics: PageMetrics
  scale: number
  paint: boolean
  pageEls: Map<number, HTMLElement>
  onVisible: (pageNumber: number, ratio: number) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const onVisibleRef = useRef(onVisible)
  onVisibleRef.current = onVisible

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    pageEls.set(pageNumber, el)
    const observer = new IntersectionObserver(
      ([entry]) => onVisibleRef.current(pageNumber, entry.intersectionRatio),
      { threshold: [0, 0.2, 0.35, 0.6] },
    )
    observer.observe(el)

    return () => {
      observer.disconnect()
      pageEls.delete(pageNumber)
    }
  }, [pageEls, pageNumber])

  useEffect(() => {
    if (!paint) return
    const canvas = canvasRef.current
    const textLayerEl = textLayerRef.current
    if (!canvas || !textLayerEl) return

    let cancelled = false
    let renderTask: RenderTask | null = null

    async function renderPage() {
      const page = await pdf.getPage(pageNumber)
      if (cancelled || !canvas || !textLayerEl) return

      const nextViewport = page.getViewport({ scale })

      const preferredOutputScale = Math.max(
        MIN_OUTPUT_SCALE,
        window.devicePixelRatio || 1,
      )
      const pixelBudgetScale = Math.sqrt(
        MAX_CANVAS_PIXELS / (nextViewport.width * nextViewport.height),
      )
      const outputScale = Math.max(
        1,
        Math.min(preferredOutputScale, pixelBudgetScale),
      )
      canvas.width = Math.ceil(nextViewport.width * outputScale)
      canvas.height = Math.ceil(nextViewport.height * outputScale)
      canvas.style.width = `${nextViewport.width}px`
      canvas.style.height = `${nextViewport.height}px`

      const context = canvas.getContext('2d', { alpha: false })
      if (!context) return
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)

      const scaleX = canvas.width / nextViewport.width
      const scaleY = canvas.height / nextViewport.height
      renderTask = page.render({
        canvas,
        viewport: nextViewport,
        transform: [scaleX, 0, 0, scaleY, 0, 0],
      })
      try {
        await renderTask.promise
      } catch {
        if (cancelled) return
      }
      if (cancelled) return

      textLayerEl.replaceChildren()
      textLayerEl.style.width = `${nextViewport.width}px`
      textLayerEl.style.height = `${nextViewport.height}px`

      const textLayer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container: textLayerEl,
        viewport: nextViewport,
      })
      await textLayer.render()
    }

    void renderPage()

    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [paint, pdf, pageNumber, scale])

  return (
    <div
      ref={wrapRef}
      className={cn('pdf-page border border-border')}
      style={{
        width: metrics.width * scale,
        height: metrics.height * scale,
      }}
    >
      {paint ? <canvas ref={canvasRef} /> : null}
      <div ref={textLayerRef} className="textLayer" />
    </div>
  )
}
