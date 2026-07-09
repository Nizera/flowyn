export const metadata = {
  title: "Termos de Serviço — Flowyn",
  description: "Termos de Serviço da plataforma Flowyn.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Termos de Serviço</h1>
        <p className="text-sm text-gray-500 mb-8">Última atualização: 09 de julho de 2026</p>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Aceitação dos Termos</h2>
            <p className="text-gray-600 leading-relaxed">
              Ao acessar ou utilizar a plataforma FlowynPay (&quot;plataforma&quot;), você concorda com estes Termos de Serviço. Se não concordar com algum dos termos, não utilize a plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Descrição do Serviço</h2>
            <p className="text-gray-600 leading-relaxed">
              A Flowyn é uma plataforma de checkout para infoprodutores que oferece processamento de pagamentos via Asaas, entrega automática de produtos digitais, gestão de afiliados e integração com plataformas de anúncios (Meta Ads).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Cadastro e Conta</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Você deve ser maior de 18 anos para criar uma conta</li>
              <li>As informações fornecidas devem ser verdadeiras e atualizadas</li>
              <li>Vous é responsável por manter a segurança de sua senha</li>
              <li>Uma pessoa física pode possuir apenas uma conta</li>
              <li>Notificaremos por e-mail sobre alterações importantes na conta</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Planos e Pagamentos</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>A plataforma cobra uma taxa fixa mensal conforme o plano contratado</li>
              <li>Planos são renovados automaticamente até cancelamento</li>
              <li>O cancelamento pode ser feito a qualquer momento, sem multa</li>
              <li>Reembolsos são disponibilizados em até 7 dias após o pagamento</li>
              <li>Os valores podem ser reajustados com aviso prévio de 30 dias</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Responsabilidades do Usuário</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Utilizar a plataforma em conformidade com a legislação vigente</li>
              <li>Não utilizá para atividades ilegais, fraudulentas ou abusivas</li>
              <li>Manter suas credenciais de acesso em segurança</li>
              <li>Fornecer informações verdadeiras ao cadastrar produtos e afiliados</li>
              <li>Responder por eventuais reclamações de consumidores</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Produtos Digitais</h2>
            <p className="text-gray-600 leading-relaxed">
              O usuário é o único responsável pelos produtos digitais que comercializa na plataforma. A Flowyn não se responsabiliza pelo conteúdo, qualidade ou entrega dos produtos, apenas pelo processamento do pagamento e pela entrega técnica do arquivo digital.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Integrações com Plataformas de Anúncios</h2>
            <p className="text-gray-600 leading-relaxed">
              Ao conectar sua conta de anúncios (Meta Ads) à plataforma, você autoriza a Flowyn a acessar dados de campanhas e métricas de desempenho exclusivamente para fins de exibição no painel e envio de eventos de conversão (CAPI). Os tokens de acesso são armazenados de forma criptografada e não são compartilhados com terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Propriedade Intelectual</h2>
            <p className="text-gray-600 leading-relaxed">
              Todo o conteúdo, design, código-fonte e marcas da plataforma são de propriedade da Flowyn e protegidos por leis de propriedade intelectual. É vedada a reprodução, distribuição ou modificação sem autorização prévia.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Limitação de Responsabilidade</h2>
            <p className="text-gray-600 leading-relaxed">
              A Flowyn não se responsabiliza por danos indiretos, perda de lucros, interrupções de serviço ou danos decorrentes do uso da plataforma. O serviço é fornecido &quot;como está&quot;, sem garantia de disponibilidade ininterrupta.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Suspensão e Cancelamento</h2>
            <p className="text-gray-600 leading-relaxed">
              A Flowyn reserva-se o direito de suspender ou cancelar contas que violem estes Termos, mediante notificação prévia. Em caso de cancelamento por parte do usuário, os dados serão mantidos por 30 dias para eventual exportação.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">11. Alterações nos Termos</h2>
            <p className="text-gray-600 leading-relaxed">
              Estes Termos podem ser atualizados a qualquer momento. Alterações significativas serão comunicadas por e-mail com pelo menos 30 dias de antecedência.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">12. Foro</h2>
            <p className="text-gray-600 leading-relaxed">
              Fica eleito o foro da Comarca de Sorocaba/SP para dirimir quaisquer questões oriundas destes Termos, com renúncia expressa a qualquer outro por mais privilegiado que seja.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">13. Contato</h2>
            <p className="text-gray-600 leading-relaxed">
              Em caso de dúvidas sobre estes Termos de Serviço:
            </p>
            <div className="mt-3 text-gray-600">
              <p><strong>E-mail:</strong> contato@flowyn.com.br</p>
              <p><strong>Site:</strong> https://flowyn.com.br</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
