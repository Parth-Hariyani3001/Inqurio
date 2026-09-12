import axios, { isAxiosError, type AxiosRequestConfig } from 'axios'

export function getApiBaseUrl() {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  if (!apiBaseUrl) {
    throw new Error('VITE_API_BASE_URL is not set')
  }

  return apiBaseUrl.replace(/\/$/, '')
}

export const api = axios.create({
  headers: {
    Accept: 'application/json',
  },
})

api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl()
  return config
})

type ApiRequestConfig = AxiosRequestConfig & {
  token?: string | null
}

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown

  constructor(
    message: string,
    options: { status: number; code?: string; details?: unknown },
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
    this.details = options.details
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function messageFromBody(data: unknown, fallback: string) {
  if (typeof data === 'string' && data.trim()) {
    return data
  }

  if (isRecord(data)) {
    if (typeof data.message === 'string' && data.message) {
      return data.message
    }
    if (typeof data.detail === 'string' && data.detail) {
      return data.detail
    }
  }

  return fallback
}

export async function apiFetch<T>(path: string, config: ApiRequestConfig = {}) {
  const { token, headers, ...rest } = config

  try {
    const response = await api.request<T>({
      url: path,
      ...rest,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    })

    return response.data
  } catch (error) {
    if (isAxiosError(error)) {
      const data = error.response?.data
      const status = error.response?.status ?? 500
      const code =
        isRecord(data) && typeof data.error === 'string' ? data.error : undefined
      const details = isRecord(data) ? data.details : undefined

      throw new ApiError(messageFromBody(data, error.message), {
        status,
        code,
        details,
      })
    }

    throw error
  }
}
