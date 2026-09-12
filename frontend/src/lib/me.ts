import { queryOptions, useQuery } from '@tanstack/react-query'
import { auth } from '@clerk/tanstack-react-start/server'
import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { apiFetch } from '#/lib/api.ts'

export type MeUser = {
  id: string
  clerk_id?: string
  email?: string
  first_name?: string | null
  last_name?: string | null
}

export const getMe = createServerFn({ method: 'GET' }).handler(async () => {
  const { isAuthenticated, getToken } = await auth()
  if (!isAuthenticated) {
    throw redirect({
      to: '/sign-in/$',
      replace: true,
    })
  }

  const token = await getToken()
  if (!token) {
    throw redirect({
      to: '/sign-in/$',
      replace: true,
    })
  }

  return apiFetch<MeUser>('/api/v1/users/me', { token })
})

export function meQueryOptions() {
  return queryOptions({
    queryKey: ['me'],
    queryFn: () => getMe(),
    staleTime: 60_000,
    retry: true,
  })
}

export function useMeQuery() {
  return useQuery(meQueryOptions())
}
