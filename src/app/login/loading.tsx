export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mx-auto h-4 w-48 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i}>
                <div className="mb-2 h-3 w-16 animate-pulse rounded bg-slate-100" />
                <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
              </div>
            ))}
            <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  )
}
