import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  CreditCard,
  FileCheck2,
  Layers3,
  LineChart,
  MousePointerClick,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Webhook,
} from 'lucide-react'

export const metadata = {
  title: 'Flowyn - Checkout para infoprodutores sem taxa por venda',
  description: 'Venda infoprodutos, cursos e mentorias com checkout transparente, area de membros e taxa Flowyn zero por venda.',
}

const readyFeatures = [
  { icon: MousePointerClick, title: 'Checkout transparente', text: 'Uma experiencia branca, direta e otimizada para fechar a compra.' },
  { icon: Layers3, title: 'Order bump nativo', text: 'Aumente o ticket medio com uma oferta complementar no checkout.' },
  { icon: PackageCheck, title: 'Entrega automatica', text: 'Libere acesso, arquivos, cursos e mentorias apos a confirmacao.' },
  { icon: LineChart, title: 'Pixels de conversao', text: 'Conecte Meta, Google e TikTok aos seus planos de venda.' },
  { icon: BarChart3, title: 'Relatorios de vendas', text: 'Acompanhe pedidos, receita, status e produtos em um painel simples.' },
  { icon: Webhook, title: 'Webhooks com logs', text: 'Integre entregas externas com historico e reenvio de eventos.' },
  { icon: WalletCards, title: 'Asaas conectado', text: 'Receba pela sua carteira Asaas CPF ou CNPJ, sem taxa Flowyn por venda.' },
  { icon: FileCheck2, title: 'Area do aluno', text: 'Cursos, mentorias, progresso, certificados e materiais em um so lugar.' },
]

const comparisonRows = [
  ['Taxa da plataforma por venda', 'R$ 0,00', 'Percentual + valor fixo'],
  ['Mensalidade', 'R$ 49', 'Geralmente R$ 0'],
  ['Checkout', 'Transparente e personalizavel', 'Varia por plataforma'],
  ['Area de membros', 'Inclusa', 'Pode ter limite ou custo extra'],
  ['Recebimento', 'Direto via Asaas', 'Saldo interno ou repasse'],
]

const savingsRows = [
  ['50 vendas de R$ 100', 'R$ 5.000,00', 'R$ 5.000,00'],
  ['Custo da plataforma', 'R$ 49,00', 'R$ 574,00'],
  ['Economia estimada', 'R$ 525,00', '-'],
]

export default function Home() {
  return (
    <main className="sales-page min-h-screen bg-[#070908] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070908]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <img src="/logo2.png" alt="Flowyn" className="h-11 w-auto" />
          <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex">
            <a href="#vantagens" className="hover:text-white">Vantagens</a>
            <a href="#comparativo" className="hover:text-white">Comparativo</a>
            <a href="#recursos" className="hover:text-white">Recursos</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden text-sm font-semibold text-white/70 hover:text-white sm:inline">Entrar</Link>
            <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-[#00e88a] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#00d77f]">
              Testar gratis <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-white/10">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 md:grid-cols-[1.05fr_.95fr] md:items-center md:py-24">
          <div className="sales-reveal">
            <div className="sales-reveal sales-delay-1 mb-5 inline-flex items-center gap-2 rounded-full border border-[#00e88a]/30 bg-[#00e88a]/10 px-3 py-1.5 text-xs font-bold text-[#00e88a]">
              <Sparkles className="h-3.5 w-3.5" /> 7 dias gratis. Depois, R$ 49 por mes.
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl md:text-6xl">
              Venda seu infoproduto sem entregar uma porcentagem para a plataforma.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/60">
              A Flowyn une checkout transparente, area do aluno, order bump, pixels e pagamentos via Asaas. Voce paga uma mensalidade previsivel e nenhuma taxa Flowyn por venda.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#00e88a] px-6 py-3.5 font-bold text-black hover:bg-[#00d77f]">
                Comecar teste de 7 dias <ArrowRight className="h-5 w-5" />
              </Link>
              <a href="#comparativo" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-6 py-3.5 font-bold text-white hover:bg-white/5">
                Ver economia
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/50">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#00e88a]" /> Taxa Flowyn zero por venda</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#00e88a]" /> Checkout focado em conversao</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#00e88a]" /> CPF ou CNPJ via Asaas</span>
            </div>
          </div>

          <div className="sales-float sales-reveal sales-delay-2 overflow-hidden rounded-lg border border-white/10 bg-[#101412] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase text-white/40">Venda aprovada</p>
                <p className="mt-1 text-2xl font-black">R$ 197,00</p>
              </div>
              <div className="rounded-full bg-[#00e88a]/10 p-3 text-[#00e88a]"><BadgeCheck className="h-6 w-6" /></div>
            </div>
            <div className="space-y-4 p-5">
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="mb-4 flex items-center justify-between text-sm"><span className="text-white/50">Pagamento</span><span className="font-bold text-[#00e88a]">Asaas conectado</span></div>
                <div className="space-y-3">
                  <Metric label="Taxa Flowyn" value="R$ 0,00" />
                  <Metric label="Produto" value="Curso online" />
                  <Metric label="Entrega" value="Acesso liberado" />
                </div>
              </div>
              <p className="text-xs leading-5 text-white/40">Tarifas financeiras da Asaas continuam aplicaveis conforme o meio de pagamento.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="vantagens" className="border-b border-white/10 bg-[#0b0e0d]">
        <div className="mx-auto max-w-7xl px-5 py-16 md:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase text-[#00e88a]">Checkout primeiro</p>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">Tudo gira em torno da venda do produtor.</h2>
            <p className="mt-4 text-white/60">Sem exposicao publica de ofertas. Seus produtos ficam sob seu controle, seus links apontam para seu checkout e seus alunos recebem acesso apos o pagamento.</p>
          </div>
          <div className="sales-reveal mt-10 grid gap-4 md:grid-cols-3">
            <FlowStep icon={ShieldCheck} number="01" title="Conecte Asaas" text="Vincule sua conta CPF ou CNPJ para receber pelas vendas." />
            <FlowStep icon={CreditCard} number="02" title="Publique o checkout" text="Crie produto, plano, order bump e personalize a pagina de pagamento." />
            <FlowStep icon={PackageCheck} number="03" title="Entregue automaticamente" text="Libere curso, mentoria, arquivo ou link externo quando o pagamento for confirmado." />
          </div>
        </div>
      </section>

      <section id="comparativo" className="border-b border-white/10">
        <div className="mx-auto max-w-7xl px-5 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold uppercase text-[#00e88a]">Previsibilidade</p>
              <h2 className="mt-3 text-3xl font-black md:text-4xl">Sua plataforma nao precisa virar socia de cada venda.</h2>
              <p className="mt-4 text-white/60">Um preco fixo mensal fica mais vantajoso conforme seu negocio cresce. As tarifas financeiras da Asaas continuam aplicaveis.</p>
              <div className="mt-8 overflow-hidden rounded-lg border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-white/60">
                    <tr><th className="px-4 py-3">Comparacao</th><th className="px-4 py-3 text-[#00e88a]">Flowyn</th><th className="px-4 py-3">Outras plataformas</th></tr>
                  </thead>
                  <tbody>{comparisonRows.map(row => <tr key={row[0]} className="border-t border-white/10"><td className="px-4 py-3 text-white/60">{row[0]}</td><td className="px-4 py-3 font-bold text-white">{row[1]}</td><td className="px-4 py-3 text-white/55">{row[2]}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
            <div className="rounded-lg border border-[#00e88a]/25 bg-[#00e88a]/5 p-6">
              <p className="text-sm font-bold uppercase text-[#00e88a]">Exemplo pratico</p>
              <h3 className="mt-2 text-2xl font-black">50 vendas de R$ 100 em um mes</h3>
              <p className="mt-2 text-sm text-white/55">Comparacao estimada com uma plataforma que cobra 8,99% + R$ 2,49 por venda. Tarifas financeiras nao incluidas.</p>
              <div className="mt-6 overflow-hidden rounded-lg border border-white/10 bg-[#0b0e0d]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-white/60"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-[#00e88a]">Flowyn</th><th className="px-4 py-3">Outra</th></tr></thead>
                  <tbody>{savingsRows.map(row => <tr key={row[0]} className="border-t border-white/10"><td className="px-4 py-3 text-white/60">{row[0]}</td><td className="px-4 py-3 font-bold text-white">{row[1]}</td><td className="px-4 py-3 text-white/55">{row[2]}</td></tr>)}</tbody>
                </table>
              </div>
              <p className="mt-5 text-xl font-black text-[#00e88a]">R$ 6.300 de economia estimada em 12 meses.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className="border-b border-white/10 bg-[#0b0e0d]">
        <div className="mx-auto max-w-7xl px-5 py-16 md:py-20">
          <p className="text-center text-sm font-bold uppercase text-[#00e88a]">Ferramentas para operar de verdade</p>
          <h2 className="mx-auto mt-3 max-w-3xl text-center text-3xl font-black md:text-4xl">Do checkout ao acompanhamento da venda.</h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {readyFeatures.map(({ icon: Icon, title, text }) => (
              <div key={title} className="sales-feature rounded-lg border border-white/10 bg-[#101412] p-5">
                <Icon className="h-5 w-5 text-[#00e88a]" />
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/50">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 md:grid-cols-[1fr_360px] md:items-center md:py-20">
          <div>
            <p className="text-sm font-bold uppercase text-[#00e88a]">Um plano simples</p>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">Comece sem risco. Cresca sem punicao.</h2>
            <p className="mt-4 max-w-2xl text-white/60">Use a Flowyn por 7 dias. Depois, mantenha sua operacao ativa por R$ 49 ao mes, sem percentual adicional sobre vendas.</p>
          </div>
          <div className="sales-price-card rounded-lg border border-[#00e88a]/35 bg-[#101412] p-6">
            <p className="text-sm font-bold text-[#00e88a]">Flowyn Pro</p>
            <div className="mt-3 flex items-baseline gap-2"><span className="text-5xl font-black">R$ 49</span><span className="text-white/45">/mes</span></div>
            <p className="mt-2 text-sm text-white/50">7 dias gratis para testar.</p>
            <Link href="/register" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#00e88a] px-5 py-3 font-bold text-black hover:bg-[#00d77f]">Comecar agora <ArrowRight className="h-4 w-4" /></Link>
            <div className="mt-5 space-y-2 text-sm text-white/60">
              <p className="flex gap-2"><Check className="h-4 w-4 text-[#00e88a]" /> Sem taxa Flowyn por venda</p>
              <p className="flex gap-2"><Check className="h-4 w-4 text-[#00e88a]" /> Checkout e area do aluno</p>
              <p className="flex gap-2"><Check className="h-4 w-4 text-[#00e88a]" /> Pagamentos via Asaas</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#00e88a] text-black">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-12 md:flex-row md:items-center">
          <div><h2 className="text-3xl font-black">Sua margem merece respirar.</h2><p className="mt-2 font-medium text-black/65">Teste a Flowyn por 7 dias e compare na pratica.</p></div>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-black px-6 py-3.5 font-bold text-white hover:bg-black/85">Criar minha conta <ArrowRight className="h-5 w-5" /></Link>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#070908]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <img src="/logo2.png" alt="Flowyn" className="h-9 w-auto opacity-80" />
          <p>Flowyn. Checkout para infoprodutores via Asaas.</p>
        </div>
      </footer>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-xs text-white/45">{label}</p><p className="mt-1 font-bold">{value}</p></div>
}

function FlowStep({ icon: Icon, number, title, text }: { icon: typeof ShieldCheck; number: string; title: string; text: string }) {
  return <div className="rounded-lg border border-white/10 bg-[#101412] p-5"><div className="flex items-center justify-between"><Icon className="h-5 w-5 text-[#00e88a]" /><span className="text-xs font-black text-white/25">{number}</span></div><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-white/50">{text}</p></div>
}
