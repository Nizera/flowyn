import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contato — Flowyn',
  description: 'Entre em contato com a equipe Flowyn.',
}

export default function ContatoPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-foreground mb-2">Contato</h1>
        <p className="text-sm text-muted mb-10">Fale com a equipe Flowyn. Estamos prontos para ajudar.</p>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">Canais de Atendimento</h2>
              <div className="space-y-4 text-sm text-muted">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg">✉</span>
                  <div>
                    <p className="font-medium text-foreground">E-mail</p>
                    <a href="mailto:suporte@flowyn.com.br" className="text-orange-500 hover:underline">suporte@flowyn.com.br</a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg">🏢</span>
                  <div>
                    <p className="font-medium text-foreground">CNPJ</p>
                    <p>67.559.501/0001-83</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-lg">📍</span>
                  <div>
                    <p className="font-medium text-foreground">Foro</p>
                    <p>Comarca de Sorocaba/SP</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3">Horário</h2>
              <p className="text-sm text-muted">Segunda a sexta, das 9h às 18h (horário de Brasília).</p>
              <p className="text-sm text-muted mt-1">Resposta em até 24h úteis.</p>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Envie uma mensagem</h2>
            <form action="/api/contact" method="POST" className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">Nome</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">E-mail</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-1">Assunto</label>
                <select
                  id="subject"
                  name="subject"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  <option value="suporte">Suporte técnico</option>
                  <option value="financeiro">Financeiro / Pagamentos</option>
                  <option value="parceria">Parceria</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-foreground mb-1">Mensagem</label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                  placeholder="Como podemos ajudar?"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-orange-400 transition-colors"
              >
                Enviar mensagem
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
