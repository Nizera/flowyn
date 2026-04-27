import Link from 'next/link'
import { Webhook, Zap, ArrowRight, CheckCircle2, Database, Layers, Server } from 'lucide-react'

export const metadata = {
  title: 'Guia de Integração Make.com | Flowyn',
  description: 'Conecte seu SaaS a Flowyn em 3 minutos usando o Make.com. Sem escrever uma única linha de código.',
}

export default function WebhookDocsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-violet-200">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 font-bold text-xl tracking-tighter">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center">
              <span className="text-white font-bold text-xs">F</span>
            </div>
            Flowyn <span className="text-slate-400 font-normal">Developers</span>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/dashboard" className="hover:text-black transition-colors">Voltar para o Painel</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-slate-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-6 border border-white/20 shadow-2xl">
            <Zap className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Integração Low-Code
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Libere o acesso do seu cliente de forma 100% automática sempre que uma venda for aprovada. Use o <strong>Make.com</strong> para conectar a Flowyn ao seu Banco de Dados em menos de 5 minutos, apenas clicando e arrastando.
          </p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-16">
        
        {/* --- STEP 1 --- */}
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-900 flex items-center justify-center font-bold text-lg mb-6">1</div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            Crie seu Webhook Receptor no Make
          </h3>
          <p className="text-slate-600 leading-relaxed mb-6">
            O Make irá gerar um link mágico para você cadastrar na Flowyn. Tudo que nós mandarmos pra esse link vai cair na sua mão visualmente.
          </p>
          <ul className="space-y-4 text-slate-600 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-slate-900 flex-shrink-0 mt-0.5" />
              <span>Crie uma conta gratuita no <strong>Make.com</strong> e inicie um novo Cenário ("Create a New Scenario").</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-slate-900 flex-shrink-0 mt-0.5" />
              <span>Na primeira bolinha (Gatilho), busque por <strong>Webhooks</strong> e escolha <strong>Custom Webhook</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-slate-900 flex-shrink-0 mt-0.5" />
              <span>Clique em <em>Add</em>, digite um nome (Ex: "Vendas Flowyn") e clique em Save.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>Ele irá gerar um link (ex: <code className="bg-white border px-1.5 py-0.5 rounded text-sm text-pink-600">https://hook.make.com/xyz123</code>). <strong>Copie esse link!</strong></span>
            </li>
          </ul>
          
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl">
            <h4 className="font-bold text-amber-900 mb-2">Payload (O que enviamos para o seu Webhook)</h4>
            <p className="text-sm text-amber-800 mb-3">Quando uma venda ocorre, enviamos automaticamente as seguintes variáveis traduzidas para a raiz do seu Make.com:</p>
            <pre className="text-xs text-amber-900 bg-amber-100 p-3 rounded-lg overflow-x-auto">
{`{
  "email": "comprador@email.com",
  "nome": "João Silva",
  "id_do_pedido": "ord_123456",
  "id_do_produto": "prd_7890",
  "id_do_plano": "pln_basic",
  ... (outros dados avançados como tracking de afiliados)
}`}
            </pre>
          </div>
        </div>

        {/* --- STEP 2 --- */}
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-900 flex items-center justify-center font-bold text-lg mb-6">2</div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            Cadastre o Link na Flowyn
          </h3>
          <p className="text-slate-600 leading-relaxed mb-6">
            Agora precisamos dizer pro nosso Checkout para onde enviar as informações do cliente quando a fatura for aprovada.
          </p>
          <ul className="space-y-4 text-slate-600 bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-slate-900 flex-shrink-0 mt-0.5" />
              <span>No Painel da Flowyn, acesse <strong>Meus Produtos &gt; Editar</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-slate-900 flex-shrink-0 mt-0.5" />
              <span>Vá até a aba <strong>Webhooks / Integração</strong>.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span>Cole o link do Make.com no campo "Endpoint Recebedor" e Salve. Você pode usar a ferramenta de Simular Compra para testar se os dados chegaram no Make.</span>
            </li>
          </ul>
        </div>

        {/* --- STEP 3 --- */}
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-900 flex items-center justify-center font-bold text-lg mb-6">3</div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">
            Conecte ao seu Banco de Dados
          </h3>
          <p className="text-slate-600 leading-relaxed mb-6">
            Volte para o Make. Agora que o Make.com já sabe receber nossos dados, você só precisa dizer a ele onde salvar o acesso do seu cliente. Escolha o banco de dados que você utiliza no seu SaaS abaixo:
          </p>

          <div className="space-y-8 mt-8">
            {/* Supabase via HTTP */}
            <div className="border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-6 h-6 text-emerald-600" />
                <h4 className="font-bold text-xl text-slate-900">Integração com Supabase</h4>
              </div>
              <p className="text-sm text-slate-600 mb-4">A forma mais versátil de integrar o Supabase é utilizando requisições diretas à API.</p>
              <ol className="list-decimal list-inside space-y-3 text-sm text-slate-700">
                <li>Adicione uma nova bolinha no Make conectada ao Webhook e busque pelo módulo <strong>HTTP</strong>.</li>
                <li>Selecione a ação <strong>Make a request</strong>.</li>
                <li>Em URL, cole o endpoint REST da sua tabela do Supabase (ex: <code className="bg-slate-100 px-1 rounded text-slate-900">https://[SEU-PROJETO].supabase.co/rest/v1/profiles</code>). Use o método <strong>POST</strong> ou <strong>PATCH</strong>.</li>
                <li>Nos Headers, adicione <code className="bg-slate-100 px-1 rounded text-slate-900">apikey</code> e <code className="bg-slate-100 px-1 rounded text-slate-900">Authorization</code> com sua <strong>Service Role Key</strong>.</li>
                <li>Defina o Body Type como <strong>Raw</strong> e Content Type como <strong>JSON (application/json)</strong>.</li>
                <li>No campo Request content, monte seu JSON arrastando as variáveis do Webhook (ex: <strong>email</strong>, <strong>id_do_plano</strong>).</li>
              </ol>
            </div>

            {/* Firebase */}
            <div className="border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Layers className="w-6 h-6 text-amber-500" />
                <h4 className="font-bold text-xl text-slate-900">Integração com Firebase / Firestore</h4>
              </div>
              <p className="text-sm text-slate-600 mb-4">Para quem usa o ecossistema do Google Cloud (Firestore).</p>
              <ol className="list-decimal list-inside space-y-3 text-sm text-slate-700">
                <li>Adicione o módulo <strong>Google Cloud Firestore</strong> no seu cenário do Make.</li>
                <li>Escolha a ação <strong>Create/Update a Document</strong>.</li>
                <li>Faça login com a conta do Google Cloud e autorize o Make.</li>
                <li>No campo Collection ID, insira a coleção dos seus usuários (ex: <code>users</code>).</li>
                <li>No campo Document ID, você pode arrastar a variável <strong>email</strong> do webhook, para usar o email como chave, ou pedir para gerar um automático.</li>
                <li>Adicione os campos que seu sistema lê (ex: <code>plan = id_do_plano</code>, <code>status = active</code>).</li>
              </ol>
            </div>

            {/* MySQL / phpMyAdmin */}
            <div className="border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Server className="w-6 h-6 text-blue-500" />
                <h4 className="font-bold text-xl text-slate-900">Integração com MySQL / phpMyAdmin</h4>
              </div>
              <p className="text-sm text-slate-600 mb-4">Para sistemas robustos legados em PHP, Laravel ou hospedagens VPS padrão.</p>
              <ol className="list-decimal list-inside space-y-3 text-sm text-slate-700">
                <li>Busque o módulo <strong>MySQL</strong> no Make.com e escolha <strong>Execute a query</strong>.</li>
                <li>Crie a conexão preenchendo o Host (IP do seu servidor), Porta (geralmente 3306), Usuário e Senha do seu banco de dados MySQL. <em>(Dica: certifique-se de liberar o IP do Make.com no Firewall do seu servidor/cPanel)</em>.</li>
                <li>No campo de Query, você fará um Insert/Update direto no banco, utilizando os dados do webhook. Por exemplo:
                  <br/>
                  <code className="block mt-2 bg-slate-900 text-slate-100 p-3 rounded">
                    UPDATE users SET plan_id = '&#123;id_do_plano&#125;', status = 'active' WHERE email = '&#123;email&#125;';
                  </code>
                </li>
                <li>Lembre-se de substituir o que está entre chaves pelas variáveis reais arrastadas do Webhook no Make.</li>
              </ol>
            </div>
            
          </div>
        </div>

        <div className="py-8 text-center text-slate-500">
          Não esqueça de clicar em <strong>Turn On</strong> no canto inferior esquerdo do Make.com. <br />
          Você automatizou sua empresa sem escrever uma linha de código. 🚀
        </div>

      </main>
    </div>
  )
}
