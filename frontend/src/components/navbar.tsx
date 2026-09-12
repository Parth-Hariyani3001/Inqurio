import { Link } from '@tanstack/react-router'
import { buttonVariants } from '@/components/ui/button'
import { Logo } from '@/components/logo'
import { NavigationSheet } from '@/components/navigation-sheet'
import { ModeToggle } from './mode-toggle'
import { cn } from '@/lib/utils'

const Navbar = () => {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          <ModeToggle />
          <Link
            className={cn(buttonVariants({ variant: 'ghost' }), 'hidden sm:inline-flex')}
            to="/sign-in/$"
          >
            Sign in
          </Link>
          <Link
            className={cn(buttonVariants(), 'hidden sm:inline-flex')}
            to="/sign-up/$"
          >
            Create account
          </Link>
          <div className="sm:hidden">
            <NavigationSheet />
          </div>
        </div>
      </div>
    </header>
  )
}

export default Navbar
