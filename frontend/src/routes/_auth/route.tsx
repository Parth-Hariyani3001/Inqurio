import { buttonVariants } from '#/components/ui/button.tsx'
import { Logo } from '#/components/logo.tsx'
import { ModeToggle } from '#/components/mode-toggle.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import { cn } from '#/lib/utils.ts'
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { requireGuest } from '#/lib/auth.ts'

export const Route = createFileRoute('/_auth')({
  component: RouteComponent,
  beforeLoad: async () => {
    return await requireGuest()
  },
})

function RouteComponent() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_min(32rem,100%)]">
      <aside className="hidden flex-col justify-between border-r bg-muted/40 px-10 py-8 lg:flex xl:px-16">
        <Logo />
        <div className="max-w-md">
          <p className="text-muted-foreground text-sm tracking-wide">
            A reading room for papers
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight">
            Keep the argument in front of you.
          </h1>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Find a paper, read it in full, and ask about the passage you are
            looking at — not a paraphrase of the abstract.
          </p>
          <blockquote className="mt-10 border-l border-border pl-4 font-serif text-lg leading-snug">
            Who is missing from the later months, and does that change the
            reported effect?
          </blockquote>
          <p className="mt-2 pl-4 text-muted-foreground text-xs tracking-wide">
            A question on the page
          </p>
        </div>
        <p className="text-muted-foreground text-sm">Inquiro</p>
      </aside>

      <div className="flex min-h-svh flex-col">
        <header className="flex items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="lg:hidden">
              <Logo />
            </div>
            <Link
              className={cn(
                buttonVariants({ variant: 'ghost' }),
                'hidden lg:inline-flex',
              )}
              to="/"
            >
              <ArrowLeft data-icon="inline-start" />
              Home
            </Link>
          </div>
          <ModeToggle />
        </header>
        <Separator className="lg:hidden" />
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
