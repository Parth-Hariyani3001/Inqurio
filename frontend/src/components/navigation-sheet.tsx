import { Menu } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Logo } from '@/components/logo'
import { Separator } from '@/components/ui/separator'

export const NavigationSheet = () => {
  return (
    <Sheet>
      <SheetTrigger>
        <Button aria-label="Open menu" size="icon" variant="ghost">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent className="px-6 py-6">
        <SheetHeader className="p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Logo />
        </SheetHeader>
        <Separator className="my-6" />
        <nav className="flex flex-col gap-2">
          <Link
            className={buttonVariants({ variant: 'ghost' })}
            to="/sign-in/$"
          >
            Sign in
          </Link>
          <Link className={buttonVariants()} to="/sign-up/$">
            Create account
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
