'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <h2 className="text-xl font-bold text-slate-900 mb-2">Erro no painel</h2>
      <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
        {error.message || 'Ocorreu um erro ao carregar o painel.'}
      </p>
      <button
        onClick={reset}
        className="bg-orange-500 text-white rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-orange-600 transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  )
}
