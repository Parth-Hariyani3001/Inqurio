import { BrainCircuit } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export const Logo = ({ className }: { className?: string }) => (
  <Link
    aria-label="Inquiro home"
    className={cn(
      'inline-flex items-center gap-2 text-foreground outline-none transition-opacity hover:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/50',
      className,
    )}
    to="/"
  >
    <BrainCircuit className="size-5" strokeWidth={1.5} />
    <span className="font-serif text-[1.125rem] leading-none tracking-tight">
      Inquiro
    </span>
  </Link>
)
