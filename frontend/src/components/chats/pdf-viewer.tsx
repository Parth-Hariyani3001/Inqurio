import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Minus,
  Plus,
  Scan,
} from 'lucide-react'
import type { Selection as AriaSelection } from 'react-aria-components'

import { PdfHighlightLayer } from '#/components/chats/pdf-highlight-layer.tsx'
import '#/components/chats/pdf-viewer.css'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import {
  clientRectsToSelection,
  getPageMetrics,
  loadPaperPdf,
  pointInPdfRect,
  TextLayer,
  type PageMetrics,
  type PageViewport,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type RenderTask,
} from '#/lib/pdf.ts'
import type { AnnotationResponse, AnnotationSelection } from '#/lib/annotations.ts'
import { HIGHLIGHT_COLORS } from '#/lib/annotations.ts'
import { cn } from '@/lib/utils'

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.15
const NEARBY_PAGES = 2

export function PdfViewer({
  paperId,
  token,
  annotations,
  color,
  onColorChange,
  activeId,
  onActiveIdChange,
  onCreateFromSelection,
  toolbarStart,
  toolbarEnd,
  focusPage,
  focusRequest,
}: {
  paperId: string
  token: string
  annotations: Array<AnnotationResponse>
  color: string
  onColorChange: (color: string) => void
  activeId: string | null
  onActiveIdChange: (id: string | null) => void
  onCreateFromSelection: (selection: AnnotationSelection) => void
  toolbarStart?: ReactNode
  toolbarEnd?: ReactNode
  focusPage?: number | null
  focusRequest?: number
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [metrics, setMetrics] = useState<Array<PageMetrics>>([])
  const [scale, setScale] = useState(1)
  const [fitWidthScale, setFitWidthScale] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notReady, setNotReady] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const pageEls = useRef(new Map<number, HTMLElement>())
  const didFitRef = useRef(false)
  const [hasMeasured, setHasMeasured] = useState(false)

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
    const scroller = scrollerRef.current
    if (!scroller || !metrics[0]) return

    const updateFit = () => {
      const available = scroller.clientWidth - 24
      const next = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, available / metrics[0].width),
      )
      setFitWidthScale(next)
      setHasMeasured(true)
    }

    updateFit()
    const observer = new ResizeObserver(updateFit)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [metrics])

  useEffect(() => {
    if (!hasMeasured || !metrics[0] || didFitRef.current) return
    didFitRef.current = true
    setScale(fitWidthScale)
  }, [fitWidthScale, hasMeasured, metrics])

  useEffect(() => {
    if (!focusPage) return
    pageEls.current.get(focusPage)?.scrollIntoView({ block: 'start' })
    setCurrentPage(focusPage)
  }, [focusPage, focusRequest])

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

  function onColorSelection(selection: AriaSelection) {
    if (selection === 'all') return
    const next = [...selection][0]
    if (typeof next === 'string') onColorChange(next)
  }

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
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-10 min-w-0 shrink-0 items-center gap-2 overflow-hidden border-b border-border bg-card px-2">
        {toolbarStart}
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1">
          <Button
            aria-label="Previous page"
            size="icon-sm"
            variant="ghost"
            isDisabled={currentPage <= 1}
            onPress={() => scrollToPage(Math.max(1, currentPage - 1))}
          >
            <ChevronLeft />
          </Button>
          <p className="min-w-16 text-center text-xs tabular-nums text-muted-foreground">
            {currentPage} / {pageCount}
          </p>
          <Button
            aria-label="Next page"
            size="icon-sm"
            variant="ghost"
            isDisabled={currentPage >= pageCount}
            onPress={() => scrollToPage(Math.min(pageCount, currentPage + 1))}
          >
            <ChevronRight />
          </Button>
          <Button
            aria-label="Zoom out"
            size="icon-sm"
            variant="ghost"
            isDisabled={scale <= MIN_SCALE}
            onPress={() =>
              setScale((current) =>
                Math.max(MIN_SCALE, current - SCALE_STEP),
              )
            }
          >
            <Minus />
          </Button>
          <Button
            aria-label="Fit width"
            size="icon-sm"
            variant="ghost"
            onPress={() => setScale(fitWidthScale)}
          >
            <Scan />
          </Button>
          <Button
            aria-label="Zoom in"
            size="icon-sm"
            variant="ghost"
            isDisabled={scale >= MAX_SCALE}
            onPress={() =>
              setScale((current) =>
                Math.min(MAX_SCALE, current + SCALE_STEP),
              )
            }
          >
            <Plus />
          </Button>
          {toolbarEnd}
        </div>
      </div>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-card px-2">
        <Highlighter className="text-muted-foreground" />
        <ToggleGroup
          aria-label="Highlight color"
          selectionMode="single"
          selectedKeys={[color]}
          onSelectionChange={onColorSelection}
          size="sm"
          variant="outline"
        >
          {HIGHLIGHT_COLORS.map((item) => (
            <ToggleGroupItem
              key={item.id}
              aria-label={item.label}
              id={item.id}
              className="px-1.5"
            >
              <span
                className="block size-3 rounded-sm ring-1 ring-foreground/20"
                style={{ backgroundColor: item.id }}
              />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-auto bg-muted/40 p-3"
      >
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
                annotations={annotations.filter(
                  (item) => item.selection.pageNumber === pageNumber,
                )}
                activeId={activeId}
                pageEls={pageEls.current}
                onVisible={onPageVisible}
                onCreateFromSelection={onCreateFromSelection}
                onActivate={onActiveIdChange}
              />
            )
          })}
        </div>
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
  annotations,
  activeId,
  pageEls,
  onVisible,
  onCreateFromSelection,
  onActivate,
}: {
  pdf: PDFDocumentProxy
  pageNumber: number
  metrics: PageMetrics
  scale: number
  paint: boolean
  annotations: Array<AnnotationResponse>
  activeId: string | null
  pageEls: Map<number, HTMLElement>
  onVisible: (pageNumber: number, ratio: number) => void
  onCreateFromSelection: (selection: AnnotationSelection) => void
  onActivate: (id: string | null) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const onVisibleRef = useRef(onVisible)
  const [viewport, setViewport] = useState<PageViewport | null>(null)
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

    function clearSelecting() {
      textLayerRef.current?.classList.remove('selecting')
    }
    window.addEventListener('mouseup', clearSelecting)

    return () => {
      observer.disconnect()
      pageEls.delete(pageNumber)
      window.removeEventListener('mouseup', clearSelecting)
    }
  }, [pageEls, pageNumber])

  useEffect(() => {
    if (!paint) return
    const canvas = canvasRef.current
    const textLayerEl = textLayerRef.current
    if (!canvas || !textLayerEl) return

    let cancelled = false
    let renderTask: RenderTask | null = null
    let page: PDFPageProxy | null = null

    async function renderPage() {
      page = await pdf.getPage(pageNumber)
      if (cancelled || !canvas || !textLayerEl) return

      const nextViewport = page.getViewport({ scale })
      setViewport(nextViewport)

      const outputScale = window.devicePixelRatio || 1
      canvas.width = Math.floor(nextViewport.width * outputScale)
      canvas.height = Math.floor(nextViewport.height * outputScale)
      canvas.style.width = `${nextViewport.width}px`
      canvas.style.height = `${nextViewport.height}px`

      const context = canvas.getContext('2d')
      if (!context) return

      renderTask = page.render({
        canvas,
        viewport: nextViewport,
        transform:
          outputScale === 1
            ? undefined
            : [outputScale, 0, 0, outputScale, 0, 0],
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

  function handleMouseDown() {
    textLayerRef.current?.classList.add('selecting')
  }

  function handleMouseUp(event: MouseEvent<HTMLDivElement>) {
    const pageEl = wrapRef.current
    const textLayerEl = textLayerRef.current
    textLayerEl?.classList.remove('selecting')
    if (!pageEl || !viewport) return

    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      if (
        textLayerEl?.contains(range.commonAncestorContainer) ||
        pageEl.contains(range.commonAncestorContainer)
      ) {
        const payload = clientRectsToSelection(
          range,
          pageEl,
          viewport,
          pageNumber,
        )
        if (payload) {
          selection.removeAllRanges()
          onCreateFromSelection(payload)
          return
        }
      }
    }

    const box = pageEl.getBoundingClientRect()
    const [pdfX, pdfY] = viewport.convertToPdfPoint(
      event.clientX - box.left,
      event.clientY - box.top,
    )
    const hit = annotations.find((annotation) =>
      annotation.selection.rects.some((rect) =>
        pointInPdfRect(pdfX, pdfY, rect),
      ),
    )
    onActivate(hit?.uid ?? null)
  }

  return (
    <div
      ref={wrapRef}
      className={cn('pdf-page border border-border')}
      style={{
        width: metrics.width * scale,
        height: metrics.height * scale,
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {paint ? <canvas ref={canvasRef} /> : null}
      {paint && viewport ? (
        <PdfHighlightLayer
          annotations={annotations}
          viewport={viewport}
          activeId={activeId}
        />
      ) : null}
      <div ref={textLayerRef} className="textLayer" />
    </div>
  )
}
