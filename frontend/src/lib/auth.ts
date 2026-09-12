import { auth, clerkClient } from '@clerk/tanstack-react-start/server'
import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

export const requireAuth = createServerFn().handler(async () => {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated) {
    throw redirect({
      to: '/sign-in/$',
      replace: true
    })
  }

  const { emailAddresses, firstName, lastName, imageUrl } =
    await clerkClient().users.getUser(userId)
    
  return {
    userId: userId,
    userData: {
      emailAddresses: emailAddresses.map((e) => ({
        id: e.id,
        email: e.emailAddress,
      })),
      firstName,
      lastName,
      imageUrl,
    },
  }
})

export const requireGuest = createServerFn().handler(async () => {
  const { isAuthenticated } = await auth()
  if (isAuthenticated) {
    throw redirect({
      to: '/dashboard/explore',
      replace: true
    })
  }
})
