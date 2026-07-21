export default function LearnLoading() {
  return (
    <div className="min-h-screen bg-[#070809]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-8 space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-4 w-72 animate-pulse rounded bg-white/[0.06]" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-[#101010]">
              <div className="h-40 animate-pulse bg-white/[0.06]" />
              <div className="space-y-3 p-5">
                <div className="h-5 w-3/4 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-4 w-full animate-pulse rounded bg-white/[0.06]" />
                <div className="flex justify-between pt-2">
                  <div className="h-4 w-16 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-4 w-12 animate-pulse rounded bg-white/[0.06]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
