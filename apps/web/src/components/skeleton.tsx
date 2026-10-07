import { cn } from '@/lib/cn';

/** Placeholder block while a page loads (pulse is turned off under prefers-reduced-motion). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none', className)} />;
}
