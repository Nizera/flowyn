# Como Configurar Produtos e Rastreamento de Vendas na FlowynPay

## Passo 1: Criar seu Produto

1. Acesse **Produtos > Criar Produto** no menu lateral
2. Preencha:
   - **Nome do produto** (ex: "Curso de Marketing Digital")
   - **Preço** (em R$)
   - **Descrição** (aparecerá no checkout)
3. Clique em **Criar Produto**
4. Anote o **Product ID** gerado (será usado nos UTMs)

---

## Passo 2: Configurar Pixel de Rastreamento (Opcional mas Recomendado)

O pixel rastreia visitas e iniciativas de checkout no seu site de vendas.

### Meta Pixel (Facebook/Instagram)

1. Acesse **Pixels** no menu lateral
2. Clique em **Conectar Pixel**
3. Selecione **Meta** como plataforma
4. Insira o **Pixel ID** do seu Gerenciador de Eventos do Meta
5. Clique em **Conectar**

### Google Ads

1. Acesse **Pixels** no menu lateral
2. Clique em **Conectar Pixel**
3. Selecione **Google** como plataforma
4. Insira o **ID de Conversão** (formato: AW-XXXXXXXXX)
5. Clique em **Conectar**

---

## Passo 3: Configurar UTMs no Meta Ads

Ao criar sua campanha no Meta Ads, configure os UTMs no campo **Parâmetros de URL**:

```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&product_id=SEU_PRODUCT_ID_AQUI
```

**Substitua** `SEU_PRODUCT_ID_AQUI` pelo ID do produto criado no Passo 1.

### Exemplo completo:
```
utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&product_id=abc123
```

---

## Passo 4: Configurar Webhook no Asaas (Obrigatório)

O webhook recebe notificações de pagamento do Asaas e atualiza automaticamente o status dos pedidos.

1. Faça login no painel do Asaas (asaas.com)
2. Vá em **Configurações > Integrações > Webhooks**
3. Clique em **Adicionar Webhook**
4. Configure:
   - **URL**: `https://flowyn.com.br/api/webhooks/asaas`
   - **Eventos**: marque todos (criação, atualização, pagamento, etc.)
5. Clique em **Salvar**

---

## Passo 5: Configurar Conexão Meta Ads (Opcional)

Para ver métricas de anúncios no dashboard:

1. Acesse **Meta Ads** no menu lateral
2. Clique em **Conectar Conta**
3. Faça login com sua conta do Facebook
4. Selecione a conta de anúncios que deseja conectar
5. Clique em **Conectar**

---

## Fluxo Completo de uma Venda Rastreada

```
1. Usuário clica no anúncio (Meta)
   → URL com UTMs é registrada
   
2. Usuário visita sua página de vendas
   → Pixel dispara evento page_view
   → Visitante é registrado no funil
   
3. Usuário clica em "Comprar"
   → Pixel dispara initiate_checkout
   → Checkout é aberto na FlowynPay
   
4. Usuário preenche dados e paga
   → Pedido é criado no Asaas
   → Webhook notifica a FlowynPay
   → Pedido é confirmado automaticamente
   
5. Dashboard atualiza automaticamente
   → Receita, ROI, ROAS são calculados
   → Funil mostra a conversão completa
```

---

## Dados que Aparecem no Dashboard

| Métrica | Fonte | Descrição |
|---------|-------|-----------|
| Faturamento | Meta Ads (atribuído) | Receita de vendas rastreadas via UTM |
| Faturamento Líquido | Meta Ads | Receita menos reembolsos |
| Gasto Total | Meta Ads | Investimento em anúncios |
| ROAS | Meta Ads | Retorno sobre investimento em anúncios |
| Lucro | Cálculo | Receita atribuída - gasto - impostos - custos |
| Receita por Status | Pedidos | Distribuição por: pago, pendente, reembolsado |
| Funil | Pedidos + Pixels | Visitas → Checkouts → Pedidos → Pagos |
| Vendas Recentes | Pedidos | Últimas 5 vendas |

---

## Troubleshooting

### "Faturamento está zerado"
- Verifique se os UTMs estão configurados corretamente no Meta Ads
- Confirme que o `product_id` nos UTMs é o mesmo do produto criado na FlowynPay
- Aguarde até 24h para que os dados sejam sincronizados

### "Vendas não aparecem"
- Verifique se o webhook do Asaas está configurado e funcionando
- Confirme que os pedidos estão com status "paid" no Asaas
- Verifique se o produto está associado à sua conta

### "Funil mostra dados zerados"
- O pixel precisa estar instalado no site de vendas
- Verifique se os eventos estão sendo disparados corretamente
- Aguarde algumas horas para que os dados sejam processados

### "Dashboard mostra dados incorretos"
- Clique em "Tentar novamente" para recarregar os dados
- Verifique se o período selecionado está correto
- Confirme que a conta de anúncios está conectada
