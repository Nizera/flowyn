import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#070908] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <p className="text-7xl font-black text-[#f97316] mb-4">404</p>
        <h1 className="text-2xl font-bold text-white mb-3">Página não encontrada</h1>
        <p className="text-sm text-white/50 mb-8">
          O link que você acessou não existe ou foi movido.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-[#f97316] px-6 py-3 text-sm font-semibold text-[#070908] transition hover:bg-[#fb923c]"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  )
}
