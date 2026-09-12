import { AlertCircle } from 'lucide-react'
import { useAuth } from '@clerk/tanstack-react-start'
import { useQuery } from '@tanstack/react-query'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { paperPdfUrlQueryOptions } from '#/lib/papers.ts'

export function PdfFolio({ paperId }: { paperId: string }) {
  const { isLoaded, getToken } = useAuth()
  const pdfQuery = useQuery(
    paperPdfUrlQueryOptions(paperId, getToken, isLoaded),
  )
  const paper = pdfQuery.data?.paper
  const notReady = paper && paper.status !== 'ready'

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-muted/40">
      <div className="flex h-10 shrink-0 items-center border-b border-border bg-card px-3">
        <p className="truncate font-serif text-sm tracking-tight">
          {paper?.title ?? 'Paper'}
        </p>
      </div>
      <div className="min-h-0 flex-1 p-3">
        {pdfQuery.isPending ? (
          <Skeleton className="size-full" />
        ) : pdfQuery.isError ? (
          <Alert variant="destructive" className="h-fit">
            <AlertCircle />
            <AlertTitle>Could not open the PDF</AlertTitle>
            <AlertDescription>
              {pdfQuery.error instanceof Error
                ? pdfQuery.error.message
                : 'The signed file URL could not be loaded.'}
            </AlertDescription>
          </Alert>
        ) : notReady ? (
          <Alert className="h-fit">
            <AlertCircle />
            <AlertTitle>This paper is not ready to read</AlertTitle>
            <AlertDescription>
              Wait until parsing finishes, then open the chat again.
            </AlertDescription>
          </Alert>
        ) : pdfQuery.data ? (
          <iframe
            className="size-full border border-border bg-background"
            src={pdfQuery.data.url}
            title={paper?.title ?? 'Paper PDF'}
          />
        ) : null}
      </div>
    </section>
  )
}
