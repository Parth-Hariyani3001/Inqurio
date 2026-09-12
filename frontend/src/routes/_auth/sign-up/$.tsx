import { SignUp, useAuth } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'
import { AuthFormFallback } from '#/components/auth-form-fallback.tsx'

export const Route = createFileRoute('/_auth/sign-up/$')({
  component: RouteComponent,
})

function RouteComponent() {
  const { isLoaded } = useAuth()

  if (!isLoaded) {
    return <AuthFormFallback />
  }

  return <SignUp />
}
