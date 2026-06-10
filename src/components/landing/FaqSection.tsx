'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { FadeInView } from './animations'

const FAQS = [
  {
    q: 'Como funciona o período grátis de 7 dias?',
    a: 'Você testa todos os recursos do Flowyn Pro por 7 dias sem custo. Não pedimos cartão de crédito. Se quiser continuar após o período, basta assinar por R$ 49/mês.',
  },
  {
    q: 'A Flowyn cobra taxa por venda?',
    a: 'Não. A Flowyn não cobra nenhum percentual sobre suas vendas. Você paga apenas R$ 49/mês de assinatura. As tarifas financeiras do Asaas (cartão, boleto, Pix) continuam sendo de responsabilidade do vendedor.',
  },
  {
    q: 'Preciso ter conta no Asaas?',
    a: 'Sim. O recebimento é feito diretamente na sua conta Asaas (CPF ou CNPJ). Isso garante que o dinheiro caia direto na sua conta sem passar por intermediários.',
  },
  {
    q: 'Posso usar meu próprio domínio no checkout?',
    a: 'Sim! Você pode configurar um domínio personalizado para seu checkout. Isso transmite mais confiança para seus clientes e fortalece sua marca.',
  },
  {
    q: 'Quais tipos de produto posso vender?',
    a: 'Cursos online, e-books, mentoria, assinaturas e qualquer infoproduto digital. Você também pode configurar order bumps para aumentar o ticket médio.',
  },
  {
    q: 'Como funciona a entrega automática?',
    a: 'Após a confirmação do pagamento, o comprador recebe automaticamente um e-mail com acesso ao produto. Cursos são liberados na área do aluno (Flowyn Play), e-books são enviados para download.',
  },
]

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="bg-[#070908] px-4 py-20 md:px-6 md:py-32">
      <div className="mx-auto max-w-3xl">
        <FadeInView>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-white mb-2">
            Perguntas frequentes
          </h2>
          <p
            className="text-sm md:text-base text-center mb-12 max-w-xl mx-auto"
            style={{ color: 'rgba(255,255,255,0.6)' }}
          >
            Dúvidas comuns sobre a Flowyn
          </p>
        </FadeInView>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <FadeInView key={i} delay={i * 0.05}>
              <div
                className="bg-[#101412] rounded-2xl border border-white/5 overflow-hidden transition-all duration-300"
                style={{
                  borderColor: openIndex === i ? 'rgba(249,115,22,0.3)' : undefined,
                }}
              >
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="text-sm sm:text-base font-medium text-white pr-4">
                    {faq.q}
                  </span>
                  <ChevronDown
                    size={16}
                    className="shrink-0 text-[#f97316] transition-transform duration-300"
                    style={{
                      transform: openIndex === i ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  />
                </button>
                <AnimatePresence>
                  {openIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p
                        className="px-5 pb-4 text-sm leading-relaxed"
                        style={{ color: 'rgba(255,255,255,0.6)' }}
                      >
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeInView>
          ))}
        </div>
      </div>
    </section>
  )
}
