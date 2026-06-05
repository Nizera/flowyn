import Link from 'next/link'
import { Webhook, Zap, ArrowRight, CheckCircle2, Database, Layers, Server } from 'lucide-react'

export const metadata = {
  title: 'Guia de Integração Make.com | Flowyn',
  description: 'Conecte sua entrega externa a Flowyn em poucos minutos usando o Make.com.',
}

export default function WebhookDocsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[#00e88a]/30">
      {/* Header */}
      <header className="bg-[#111111] border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 font-bold text-xl tracking-tighter">
            <img src="/logo2.png" alt="Flowyn" className="h-20 w-auto" />
            <span className="text-white/50 font-normal ml-2 border-l border-white/20 pl-3">Developers</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium text-white/70">
            <Link href="/dashboard" className="hover:text-white transition-colors">Voltar para o Painel</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-[#0a0a0a] text-white py-20 px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#00e88a]/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 mb-6 border border-white/10 shadow-[0_0_30px_rgba(0,232,138,0.1)]">
            <Zap className="w-8 h-8 text-[#00e88a]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Integração Low-Code
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
            Libere o acesso do seu cliente de forma 100% automática sempre que uma venda for aprovada. Use o <strong className="text-white">Make.com</strong> para conectar a Flowyn ao seu Banco de Dados em menos de 5 minutos, apenas clicando e arrastando.
          </p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-16 relative z-10">
        
        {/* --- STEP 1 --- */}
        <div className="bg-[#111111] border border-white/10 p-8 rounded-3xl shadow-2xl">
          <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-lg mb-6 shadow-[0_0_15px_rgba(255,255,255,0.05)]">1</div>
          <h3 className="text-2xl font-bold text-white mb-4">
            Crie seu Webhook Receptor no Make
          </h3>
          <p className="text-white/70 leading-relaxed mb-6">
            O Make irá gerar um link mágico para você cadastrar na Flowyn. Tudo que nós mandarmos pra esse link vai cair na sua mão visualmente.
          </p>
          <ul className="space-y-4 text-white/70 mb-8 bg-[#0a0a0a] p-6 rounded-2xl border border-white/5">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00e88a] flex-shrink-0 mt-0.5" />
              <span>Crie uma conta gratuita no <strong className="text-white">Make.com</strong> e inicie um novo Cenário ("Create a New Scenario").</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00e88a] flex-shrink-0 mt-0.5" />
              <span>Na primeira bolinha (Gatilho), busque por <strong className="text-white">Webhooks</strong> e escolha <strong className="text-white">Custom Webhook</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00e88a] flex-shrink-0 mt-0.5" />
              <span>Clique em <em className="text-white">Add</em>, digite um nome (Ex: "Vendas Flowyn") e clique em Save.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00e88a] flex-shrink-0 mt-0.5" />
              <span>Ele irá gerar um link (ex: <code className="bg-white/10 border border-white/20 px-1.5 py-0.5 rounded text-sm text-[#00e88a]">https://hook.make.com/xyz123</code>). <strong className="text-white">Copie esse link!</strong></span>
            </li>
          </ul>
          
          <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl">
            <h4 className="font-bold text-amber-400 mb-2">Payload (O que enviamos para o seu Webhook)</h4>
            <p className="text-sm text-amber-200/70 mb-3">Quando uma venda ocorre, enviamos automaticamente as seguintes variáveis traduzidas para a raiz do seu Make.com:</p>
            <pre className="text-xs text-amber-400 bg-[#0a0a0a] border border-amber-500/10 p-3 rounded-lg overflow-x-auto">
{`{
  "email": "comprador@email.com",
  "nome": "João Silva",
  "id_do_pedido": "ord_123456",
  "id_do_produto": "prd_7890",
  "id_do_plano": "pln_basic",
  ... (outros dados avancados do pedido)
}`}
            </pre>
          </div>
        </div>

        {/* --- STEP 2 --- */}
        <div className="bg-[#111111] border border-white/10 p-8 rounded-3xl shadow-2xl">
          <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-lg mb-6 shadow-[0_0_15px_rgba(255,255,255,0.05)]">2</div>
          <h3 className="text-2xl font-bold text-white mb-4">
            Cadastre o Link na Flowyn
          </h3>
          <p className="text-white/70 leading-relaxed mb-6">
            Agora precisamos dizer pro nosso Checkout para onde enviar as informações do cliente quando a fatura for aprovada.
          </p>
          <ul className="space-y-4 text-white/70 bg-[#0a0a0a] p-6 rounded-2xl border border-white/5">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00e88a] flex-shrink-0 mt-0.5" />
              <span>No Painel da Flowyn, acesse <strong className="text-white">Meus Produtos &gt; Editar</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00e88a] flex-shrink-0 mt-0.5" />
              <span>Vá até a aba <strong className="text-white">Webhooks / Integração</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#00e88a] flex-shrink-0 mt-0.5" />
              <span>Cole o link do Make.com no campo "Endpoint Recebedor" e Salve. Você pode usar a ferramenta de Simular Compra para testar se os dados chegaram no Make.</span>
            </li>
          </ul>
        </div>

        {/* --- STEP 3 --- */}
        <div className="bg-[#111111] border border-white/10 p-8 rounded-3xl shadow-2xl">
          <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-lg mb-6 shadow-[0_0_15px_rgba(255,255,255,0.05)]">3</div>
          <h3 className="text-2xl font-bold text-white mb-4">
            Conecte ao seu Banco de Dados
          </h3>
          <p className="text-white/70 leading-relaxed mb-6">
            Volte para o Make. Agora que o Make.com ja sabe receber nossos dados, voce so precisa dizer a ele onde salvar o acesso do seu cliente. Escolha o banco de dados que voce utiliza na sua entrega externa abaixo:
          </p>

          <div className="space-y-8 mt-8">
            {/* Supabase via HTTP */}
            <div className="border border-white/10 bg-[#0a0a0a] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-6 h-6 text-[#00e88a]" />
                <h4 className="font-bold text-xl text-white">Integração com Supabase</h4>
              </div>
              <p className="text-sm text-white/60 mb-4">A forma mais versátil de integrar o Supabase é utilizando requisições diretas à API.</p>
              <ol className="list-decimal list-inside space-y-3 text-sm text-white/70">
                <li>Adicione uma nova bolinha no Make conectada ao Webhook e busque pelo módulo <strong className="text-white">HTTP</strong>.</li>
                <li>Selecione a ação <strong className="text-white">Make a request</strong>.</li>
                <li>Em URL, cole o endpoint REST da sua tabela do Supabase (ex: <code className="bg-white/10 px-1 rounded text-[#00e88a]">https://[SEU-PROJETO].supabase.co/rest/v1/profiles</code>). Use o método <strong className="text-white">POST</strong> ou <strong className="text-white">PATCH</strong>.</li>
                <li>Nos Headers, adicione <code className="bg-white/10 px-1 rounded text-[#00e88a]">apikey</code> e <code className="bg-white/10 px-1 rounded text-[#00e88a]">Authorization</code> com sua <strong className="text-white">Service Role Key</strong>.</li>
                <li>Defina o Body Type como <strong className="text-white">Raw</strong> e Content Type como <strong className="text-white">JSON (application/json)</strong>.</li>
                <li>No campo Request content, monte seu JSON arrastando as variáveis do Webhook (ex: <strong className="text-white">email</strong>, <strong className="text-white">id_do_plano</strong>).</li>
              </ol>
            </div>

            {/* Firebase */}
            <div className="border border-white/10 bg-[#0a0a0a] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Layers className="w-6 h-6 text-amber-400" />
                <h4 className="font-bold text-xl text-white">Integração com Firebase / Firestore</h4>
              </div>
              <p className="text-sm text-white/60 mb-4">Para quem usa o ecossistema do Google Cloud (Firestore).</p>
              <ol className="list-decimal list-inside space-y-3 text-sm text-white/70">
                <li>Adicione o módulo <strong className="text-white">Google Cloud Firestore</strong> no seu cenário do Make.</li>
                <li>Escolha a ação <strong className="text-white">Create/Update a Document</strong>.</li>
                <li>Faça login com a conta do Google Cloud e autorize o Make.</li>
                <li>No campo Collection ID, insira a coleção dos seus usuários (ex: <code className="text-[#00e88a]">users</code>).</li>
                <li>No campo Document ID, você pode arrastar a variável <strong className="text-white">email</strong> do webhook, para usar o email como chave, ou pedir para gerar um automático.</li>
                <li>Adicione os campos que seu sistema lê (ex: <code className="text-[#00e88a]">plan = id_do_plano</code>, <code className="text-[#00e88a]">status = active</code>).</li>
              </ol>
            </div>

            {/* MySQL / phpMyAdmin */}
            <div className="border border-white/10 bg-[#0a0a0a] rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Server className="w-6 h-6 text-blue-400" />
                <h4 className="font-bold text-xl text-white">Integração com MySQL / phpMyAdmin</h4>
              </div>
              <p className="text-sm text-white/60 mb-4">Para sistemas robustos legados em PHP, Laravel ou hospedagens VPS padrão.</p>
              <ol className="list-decimal list-inside space-y-3 text-sm text-white/70">
                <li>Busque o módulo <strong className="text-white">MySQL</strong> no Make.com e escolha <strong className="text-white">Execute a query</strong>.</li>
                <li>Crie a conexão preenchendo o Host (IP do seu servidor), Porta (geralmente 3306), Usuário e Senha do seu banco de dados MySQL. <em className="text-white/50">(Dica: certifique-se de liberar o IP do Make.com no Firewall do seu servidor/cPanel)</em>.</li>
                <li>No campo de Query, você fará um Insert/Update direto no banco, utilizando os dados do webhook. Por exemplo:
                  <br/>
                  <code className="block mt-3 bg-[#111111] border border-white/5 text-[#00e88a] p-3 rounded">
                    UPDATE users SET plan_id = '&#123;id_do_plano&#125;', status = 'active' WHERE email = '&#123;email&#125;';
                  </code>
                </li>
                <li>Lembre-se de substituir o que está entre chaves pelas variáveis reais arrastadas do Webhook no Make.</li>
              </ol>
            </div>
            
          </div>
        </div>

        <div className="py-8 text-center text-white/50">
          Não esqueça de clicar em <strong className="text-white">Turn On</strong> no canto inferior esquerdo do Make.com. <br />
          Você automatizou sua empresa sem escrever uma linha de código. 🚀
        </div>

      </main>
    </div>
  )
}

