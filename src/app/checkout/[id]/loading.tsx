export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_390px] lg:items-start">
          <section className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="h-24 w-24 animate-pulse rounded-2xl bg-slate-100" />
                <div className="flex-1 space-y-3">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-80 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="mb-6 border-b border-slate-100 pb-5">
                <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
                <div className="mt-1 h-6 w-40 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
                ))}
                <div className="h-14 w-full animate-pulse rounded-xl bg-slate-100" />
              </div>
            </div>
          </section>

          <aside className="lg:sticky lg:top-8">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-6">
                <div className="h-3 w-28 animate-pulse rounded bg-slate-100" />
                <div className="mt-5 flex gap-4">
                  <div className="h-20 w-20 animate-pulse rounded-2xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              </div>
              <div className="space-y-4 p-6">
                {[1, 2].map(i => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                    <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                  </div>
                ))}
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex justify-between">
                    <div className="h-4 w-12 animate-pulse rounded bg-slate-100" />
                    <div className="h-7 w-28 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
