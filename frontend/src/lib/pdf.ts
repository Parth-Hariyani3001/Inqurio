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

export { TextLayer }
export type { PDFDocumentProxy, PDFPageProxy, PageViewport, RenderTask }
