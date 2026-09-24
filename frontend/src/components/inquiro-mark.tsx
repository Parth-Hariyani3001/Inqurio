import { cn } from '@/lib/utils'

export function InquiroMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={cn('shrink-0', className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M6.4 1.9h11.2A3.9 3.9 0 0 1 21.5 5.8v11.2a3.9 3.9 0 0 1-3.9 3.9H6.4a3.9 3.9 0 0 1-3.9-3.9V5.8A3.9 3.9 0 0 1 6.4 1.9Zm2.2 5.2h6.8A2 2 0 0 1 17.4 9.1v5.8a2 2 0 0 1-2 2H8.6a2 2 0 0 1-2-2V9.1a2 2 0 0 1 2-2Z"
        fill="currentColor"
        fillRule="evenodd"
      />
      <path
        className="stroke-highlight"
        d="M14.55 15.35 20.05 19.9"
        strokeLinecap="round"
        strokeWidth="3.2"
      />
    </svg>
  )
}
