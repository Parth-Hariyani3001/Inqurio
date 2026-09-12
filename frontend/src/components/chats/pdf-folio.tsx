import { lazy, Suspense, useEffect, useState } from 'react'
import { useAuth } from '@clerk/tanstack-react-start'

import { Skeleton } from '@/components/ui/skeleton'

const PdfViewer = lazy(() =>
  import('#/components/chats/pdf-viewer.tsx').then((mod) => ({
    default: mod.PdfViewer,
  })),
)

export function PdfFolio({
  paperId,
  title,
  onHide,
}: {
  paperId: string
  title?: string
  onHide?: () => void
}) {
  const { isLoaded, getToken } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    void getToken().then(setToken)
  }, [getToken, isLoaded])

  if (!mounted || !token) {
    return (
      <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-muted">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-11 min-w-0 shrink-0 items-center border-b border-border bg-card px-3">
            <p className="min-w-0 truncate font-serif text-sm tracking-tight">
              {title ?? 'Paper'}
            </p>
          </div>
          <div className="h-full min-h-0 flex-1 p-3">
            <Skeleton className="size-full" />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-muted">
      <Suspense
        fallback={
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex h-11 min-w-0 shrink-0 items-center border-b border-border bg-card px-3">
              <p className="min-w-0 truncate font-serif text-sm tracking-tight">
                {title ?? 'Paper'}
              </p>
            </div>
            <div className="h-full min-h-0 flex-1 p-3">
              <Skeleton className="size-full" />
            </div>
          </div>
        }
      >
        <PdfViewer
          paperId={paperId}
          token={token}
          title={title}
          onHide={onHide}
        />
      </Suspense>
    </section>
  )
}
