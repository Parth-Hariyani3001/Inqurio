import { createMiddleware } from "@tanstack/react-start";

export const loggingMiddleware = createMiddleware({ type: 'request' }).server(
    ({ request, next }) => {
        const url = new URL(request.url);
        const timestamp = new Date().toLocaleString()

        console.log(`[${timestamp}] - [${request.method}] [${url.pathname}]`)
        return next()
    }
)