import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#070908]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <img src="/brand/logo-white-transparent.png" alt="Flowyn" className="h-8 w-auto" />
            <p className="mt-3 text-sm text-white/40 leading-relaxed">
              Checkout para infoprodutores com custo previsível. Sem taxa por venda.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white/70 mb-3">Produto</h4>
            <ul className="space-y-2 text-sm text-white/40">
              <li><a href="#recursos" className="hover:text-white transition">Recursos</a></li>
              <li><a href="#precos" className="hover:text-white transition">Preços</a></li>
              <li><a href="#faq" className="hover:text-white transition">FAQ</a></li>
              <li><Link href="/login" className="hover:text-white transition">Entrar</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white/70 mb-3">Legal & Contato</h4>
            <ul className="space-y-2 text-sm text-white/40">
              <li><Link href="/terms" className="hover:text-white transition">Termos de Serviço</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition">Política de Privacidade</Link></li>
              <li><Link href="/contato" className="hover:text-white transition">Contato</Link></li>
              <li className="pt-1">
                <a href="mailto:suporte@flowyn.com.br" className="hover:text-white transition">suporte@flowyn.com.br</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/5 pt-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-xs text-white/25">
          <p>&copy; 2026 Flowyn. Todos os direitos reservados.</p>
          <p>CNPJ: 67.559.501/0001-83</p>
        </div>
      </div>
    </footer>
  )
}
