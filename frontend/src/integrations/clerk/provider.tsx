import type { ReactNode } from 'react'
import { ClerkProvider } from '@clerk/tanstack-react-start'
import { shadcn } from '@clerk/ui/themes'

const clerkAppearance = {
  theme: shadcn,
  variables: {
    borderRadius: '0.4rem',
    colorBorder: 'var(--border)',
    colorShadow: 'transparent',
    fontFamily: 'var(--font-sans)',
    colorBackground: 'transparent',
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'shadow-none border-0 bg-transparent',
    card: 'shadow-none bg-transparent',
    headerTitle: 'font-serif text-foreground tracking-tight',
    headerSubtitle: 'text-muted-foreground',
    socialButtonsBlockButton:
      'border border-border bg-background text-foreground hover:bg-muted',
    formButtonPrimary:
      'bg-primary text-primary-foreground hover:bg-primary/90',
    footerActionLink: 'text-primary hover:text-primary/80',
  },
} as const

export default function AppClerkProvider({
  children,
}: {
  children: ReactNode
}) {
  return (
    <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>
  )
}
