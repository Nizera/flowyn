export const metadata = {
  title: "Política de Privacidade — Flowyn",
  description: "Política de Privacidade da plataforma Flowyn.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mb-8">Última atualização: 09 de julho de 2026</p>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Introdução</h2>
            <p className="text-gray-600 leading-relaxed">
              A Flowyn (&quot;nós&quot;, &quot;nosso&quot;) está comprometida em proteger a privacidade dos usuários da plataforma FlowynPay (&quot;plataforma&quot;). Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018) e outras legislações aplicáveis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Dados Coletados</h2>
            <p className="text-gray-600 leading-relaxed mb-3">Coletamos os seguintes tipos de dados:</p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li><strong>Dados de cadastro:</strong> nome, e-mail, senha (criptografada), telefone</li>
              <li><strong>Dados de pagamento:</strong> informações de cobrança processadas via Asaas (não armazenamos dados de cartão de crédito)</li>
              <li><strong>Dados de CPF/CNPJ:</strong> documento fiscal para emissão de notas fiscais</li>
              <li><strong>Dados de navegação:</strong> endereço IP, navegador, dispositivo, páginas acessadas</li>
              <li><strong>Dados de anúncios:</strong> contas de anúncios Meta conectadas via OAuth, tokens de acesso criptografados, métricas de campanhas</li>
              <li><strong>Dados de rastreamento:</strong> parâmetros UTM, fbclid, gclid, ttclid, cookies de pixel (_fbp, _fbc)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Finalidade do Tratamento</h2>
            <p className="text-gray-600 leading-relaxed mb-3">Utilizamos seus dados para:</p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Processar transações e gerenciar cobranças</li>
              <li>Entregar produtos digitais adquiridos</li>
              <li>Gerenciar contas de anúncios conectadas via API</li>
              <li>Enviar eventos de conversão para o Meta Conversions API (CAPI)</li>
              <li>Enviar comunicações sobre sua conta e transações</li>
              <li>Melhorar a experiência na plataforma</li>
              <li>Cumprir obrigações legais e fiscais</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Compartilhamento de Dados</h2>
            <p className="text-gray-600 leading-relaxed">
              Seus dados podem ser compartilhados com:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4 mt-3">
              <li><strong>Asaas:</strong> processamento de pagamentos</li>
              <li><strong>Meta (Facebook):</strong> envio de eventos de conversão via CAPI e acesso a dados de anúncios via OAuth</li>
              <li><strong>Supabase:</strong> hospedagem e armazenamento de dados</li>
              <li><strong>Resend:</strong> envio de e-mails transacionais</li>
              <li>Autoridades competentes, quando exigido por lei</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Segurança dos Dados</h2>
            <p className="text-gray-600 leading-relaxed">
              Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo criptografia AES-256-GCM para tokens sensíveis, autenticação segura via Supabase Auth, acesso restrito via Row Level Security (RLS) e transmissão criptografada via HTTPS/TLS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Retenção de Dados</h2>
            <p className="text-gray-600 leading-relaxed">
              Seus dados são mantidos enquanto sua conta estiver ativa. Após a exclusão da conta, os dados pessoais são removidos ou anonimizados em até 30 dias, exceto quando exigido por obrigação legal (ex: dados fiscais devem ser mantidos por 5 anos).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Seus Direitos (LGPD)</h2>
            <p className="text-gray-600 leading-relaxed mb-3">Conforme a LGPD, você tem direito a:</p>
            <ul className="list-disc list-inside text-gray-600 space-y-2 ml-4">
              <li>Confirmar a existência de tratamento de dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar a exclusão de dados desnecessários</li>
              <li>Solicitar a portabilidade dos dados</li>
              <li>Revogar o consentimento a qualquer momento</li>
              <li>Solicitar informações sobre o compartilhamento de dados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Exclusão de Dados</h2>
            <p className="text-gray-600 leading-relaxed">
              Para solicitar a exclusão dos seus dados, acesse nossa{' '}
              <a href="https://flowyn.com.br/api/meta-ads/data-deletion" className="text-orange-600 hover:underline">
                página de instruções de exclusão
              </a>{' '}
              ou entre em contato com nosso Encarregado de Proteção de Dados. A exclusão será processada em até 15 dias úteis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Cookies</h2>
            <p className="text-gray-600 leading-relaxed">
              Utilizamos cookies essenciais para o funcionamento da plataforma e cookies de rastreamento (Facebook Pixel, Google Ads) para medir o desempenho de anúncios. Você pode gerenciar suas preferências de cookies nas configurações do navegador.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Alterações nesta Política</h2>
            <p className="text-gray-600 leading-relaxed">
              Podemos atualizar esta Política de Privacidade periodicamente. Alterações significativas serão comunicadas por e-mail ou aviso na plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">11. Contato</h2>
            <p className="text-gray-600 leading-relaxed">
              Em caso de dúvidas sobre esta Política de Privacidade ou sobre o tratamento de seus dados, entre em contato com nosso Encarregado de Proteção de Dados:
            </p>
            <div className="mt-3 text-gray-600">
              <p><strong>E-mail:</strong> contato@flowyn.com.br</p>
              <p><strong>Encarregado:</strong> Daniel Mariano</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
