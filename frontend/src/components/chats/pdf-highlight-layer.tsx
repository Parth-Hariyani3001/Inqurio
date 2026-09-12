import { pdfRectToViewport, type PageViewport } from '#/lib/pdf.ts'
import type { AnnotationResponse } from '#/lib/annotations.ts'
import { cn } from '@/lib/utils'

export function PdfHighlightLayer({
  annotations,
  viewport,
  activeId,
}: {
  annotations: Array<AnnotationResponse>
  viewport: PageViewport
  activeId: string | null
}) {
  return (
    <div className="highlight-layer" aria-hidden>
      {annotations.flatMap((annotation) =>
        annotation.selection.rects.map((rect, index) => {
          const box = pdfRectToViewport(rect, viewport)
          return (
            <span
              key={`${annotation.uid}-${index}`}
              className={cn(
                'absolute mix-blend-multiply dark:mix-blend-screen',
                activeId === annotation.uid ? 'ring-1 ring-foreground/40' : null,
              )}
              style={{
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
                backgroundColor: annotation.color,
                opacity: 0.45,
              }}
            />
          )
        }),
      )}
    </div>
  )
}
