import {
  GlobalWorkerOptions,
  TextLayer,
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type PageViewport,
  type RenderTask,
} from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import { getApiBaseUrl } from '#/lib/api.ts'
import type { AnnotationRect, AnnotationSelection } from '#/lib/annotations.ts'

let workerConfigured = false

export function setupPdfWorker() {
  if (workerConfigured) return
  GlobalWorkerOptions.workerSrc = workerUrl
  workerConfigured = true
}

export async function loadPaperPdf(paperId: string, token: string) {
  setupPdfWorker()

  const loadingTask = getDocument({
    url: `${getApiBaseUrl()}/api/v1/papers/${encodeURIComponent(paperId)}/pdf`,
    httpHeaders: {
      Authorization: `Bearer ${token}`,
    },
    withCredentials: false,
    disableRange: true,
    disableStream: true,
    disableAutoFetch: true,
  })

  return loadingTask.promise
}

export type PageMetrics = {
  width: number
  height: number
}

export async function getPageMetrics(pdf: PDFDocumentProxy) {
  const pages: Array<PageMetrics> = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    pages.push({ width: viewport.width, height: viewport.height })
  }

  return pages
}

function isGlyphSpan(node: Element) {
  return (
    node.tagName === 'SPAN' &&
    !node.classList.contains('markedContent') &&
    !node.classList.contains('endOfContent')
  )
}

function intersectRanges(selection: Range, spanRange: Range) {
  if (selection.compareBoundaryPoints(Range.END_TO_START, spanRange) <= 0) {
    return null
  }
  if (selection.compareBoundaryPoints(Range.START_TO_END, spanRange) >= 0) {
    return null
  }

  const next = selection.cloneRange()
  if (selection.compareBoundaryPoints(Range.START_TO_START, spanRange) < 0) {
    next.setStart(spanRange.startContainer, spanRange.startOffset)
  }
  if (selection.compareBoundaryPoints(Range.END_TO_END, spanRange) > 0) {
    next.setEnd(spanRange.endContainer, spanRange.endOffset)
  }
  return next.collapsed ? null : next
}

function mergeLineRects(rects: Array<AnnotationRect>) {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x)
  const merged: Array<AnnotationRect> = []

  for (const rect of sorted) {
    const previous = merged.at(-1)
    if (!previous) {
      merged.push({ ...rect })
      continue
    }

    const sameLine =
      Math.abs(previous.y - rect.y) <= Math.max(previous.height, rect.height) * 0.35
    const touching =
      rect.x <= previous.x + previous.width + Math.max(previous.height, rect.height) * 0.2

    if (sameLine && touching) {
      const right = Math.max(previous.x + previous.width, rect.x + rect.width)
      const bottom = Math.max(previous.y + previous.height, rect.y + rect.height)
      previous.x = Math.min(previous.x, rect.x)
      previous.y = Math.min(previous.y, rect.y)
      previous.width = right - previous.x
      previous.height = bottom - previous.y
      continue
    }

    merged.push({ ...rect })
  }

  return merged
}

export function clientRectsToSelection(
  range: Range,
  pageEl: HTMLElement,
  viewport: PageViewport,
  pageNumber: number,
): AnnotationSelection | null {
  const pageBox = pageEl.getBoundingClientRect()
  const maxHeight = Math.min(viewport.height * 0.08, 28 * viewport.scale)
  const clientRects: Array<DOMRect> = []
  const textLayer = pageEl.querySelector('.textLayer')
  const texts: Array<string> = []

  if (textLayer) {
    for (const span of textLayer.querySelectorAll('span')) {
      if (!isGlyphSpan(span) || !range.intersectsNode(span)) continue

      const spanRange = document.createRange()
      spanRange.selectNodeContents(span)
      let clipped: Range | null = null
      try {
        clipped = intersectRanges(range, spanRange)
      } catch {
        clipped = null
      }
      if (!clipped) continue

      const piece = clipped.toString()
      if (piece) texts.push(piece)
      clientRects.push(...clipped.getClientRects())
    }
  } else {
    clientRects.push(...range.getClientRects())
    texts.push(range.toString())
  }

  const rects: Array<AnnotationRect> = []

  for (const clientRect of clientRects) {
    if (clientRect.width < 1 || clientRect.height < 1) continue
    if (clientRect.height > maxHeight) continue
    if (clientRect.bottom < pageBox.top || clientRect.top > pageBox.bottom) {
      continue
    }

    const x1 = clientRect.left - pageBox.left
    const y1 = clientRect.top - pageBox.top
    const x2 = x1 + clientRect.width
    const y2 = y1 + clientRect.height
    const [pdfX1, pdfY1] = viewport.convertToPdfPoint(x1, y1)
    const [pdfX2, pdfY2] = viewport.convertToPdfPoint(x2, y2)

    rects.push({
      x: Math.min(pdfX1, pdfX2),
      y: Math.min(pdfY1, pdfY2),
      width: Math.abs(pdfX2 - pdfX1),
      height: Math.abs(pdfY2 - pdfY1),
    })
  }

  const selectedText = texts.join(' ').replace(/\s+/g, ' ').trim()
  const merged = mergeLineRects(rects)
  if (!merged.length || !selectedText) return null

  return { pageNumber, rects: merged, selectedText }
}

export function pdfRectToViewport(rect: AnnotationRect, viewport: PageViewport) {
  const [x1, y1] = viewport.convertToViewportPoint(rect.x, rect.y)
  const [x2, y2] = viewport.convertToViewportPoint(
    rect.x + rect.width,
    rect.y + rect.height,
  )

  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  }
}

export function pointInPdfRect(
  x: number,
  y: number,
  rect: AnnotationRect,
) {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  )
}

export { TextLayer }
export type { PDFDocumentProxy, PDFPageProxy, PageViewport, RenderTask }
