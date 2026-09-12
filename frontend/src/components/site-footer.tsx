import { Separator } from '@/components/ui/separator'

export function SiteFooter() {
  return (
    <footer>
      <Separator />
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-8 text-muted-foreground text-sm sm:flex-row sm:items-baseline sm:justify-between sm:px-6">
        <p className="font-serif text-foreground">Inquiro</p>
        <p>A reading room for research papers</p>
      </div>
    </footer>
  )
}
