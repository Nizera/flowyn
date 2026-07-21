// CORREÇÃO C2 (auditoria tracking): o GlobalPixels anterior disparava um evento de
// "conversion" do Google Ads em TODAS as páginas (incluindo a landing page), inflando
// as conversões do Google Ads. A tag era para um anúncio pessoal do dono, não para
// produtores. Como a funcionalidade de Google Ads para produtores ainda não existe,
// removemos o GlobalPixels por completo para evitar confusão. Produtores continuam
// pixelizando suas páginas de checkout via PixelScripts na própria checkout page.
import { PixelScripts } from '@/components/PixelScripts'

export function GlobalPixels() {
  // Google Ads para produtores ainda não implementado — sem pixels globais por enquanto.
  // Quando implementado, este componente deve disparar apenas PageView (não "conversion")
  // e apenas nas rotas de checkout/obrigado, nunca na landing page.
  return null
}
