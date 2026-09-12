import { Skeleton } from '@/components/ui/skeleton'

export function AuthFormFallback() {
  return (
    <div className="flex w-full flex-col gap-4">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-4 w-52" />
      <Skeleton className="mt-4 h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="mt-2 h-9 w-full" />
    </div>
  )
}
