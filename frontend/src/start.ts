import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

import { clerkMiddleware } from '@clerk/tanstack-react-start/server'
import { loggingMiddleware } from './middlewares/logging';

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [loggingMiddleware, csrfMiddleware, clerkMiddleware()],
}))
