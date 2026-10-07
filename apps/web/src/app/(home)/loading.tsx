import { Skeleton } from '@/components/skeleton';

/**
 * Homepage loading state: the shape of the top stories and the latest feed. It lives in the `(home)` group so it
 * wraps only `/`: a loading boundary above an article or person page would start streaming with status 200
 * before the page can call `notFound()`, turning real 404s into soft 404s.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-page space-y-8 px-gutter py-6" aria-busy="true">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-16 w-full" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
