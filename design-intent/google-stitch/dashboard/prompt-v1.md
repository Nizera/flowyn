<!-- Layout: FlowynPay Dashboard — Visão Geral -->
Design a responsive web dashboard for FlowynPay, a Brazilian infoprodutor payment platform and ad tracker. This is the main "Visão Geral" (Overview) page that shows the seller's complete business health at a glance.

The dashboard must feel premium, modern, and completely unique — NOT a generic Bootstrap/Tailwind dashboard. Think Stripe Dashboard meets Linear meets Vercel Analytics. Clean, data-dense, with subtle depth and motion.

Include:
- Left sidebar with FlowynPay logo (orange gradient F icon), navigation (Dashboard, Carteira, Meus Acessos, Criar Produto, Meus Produtos, Minhas Vendas, Meta Ads, Pixels, Pagamentos, Assinatura, Minha Conta). Active item has an orange accent bar on the left.
- Top header with page title "Visão Geral" on the left, a sales goal progress bar (Meta R$ X / R$ Y) in the center-right, notification bell, and user avatar on the far right.
- Main content area with a dense, information-rich layout.

The main content should have these sections stacked vertically:

**Section 1 — Revenue Hero (top, full width):**
A large, prominent card showing today's key numbers. Not 8 small cards — instead, one wide "hero" card with:
- Left side: Large "Faturamento Hoje" number in bold (R$ 0,00 style), with a subtle sparkline showing last 7 days trend
- Center: 3 compact stats in a row: "Vendas" count, "Ticket Médio" (ARPU), "ROI"
- Right side: A circular progress ring showing the daily sales goal progress (like a donut chart but thin and elegant)

**Section 2 — Performance Strip (below hero, full width):**
A horizontal strip of 6 compact metric pills, each showing:
- Metric name (small, muted)
- Value (bold, large)
- Delta indicator (green up arrow + percentage or red down arrow + percentage)
- Mini sparkline (tiny line showing 7-day trend)
Metrics: Faturamento Líquido, Gasto com Anúncios, ROAS, Lucro Líquido, Margem de Lucro, Chargeback

**Section 3 — Conversion Funnel (left 60%, below strip):**
A modern funnel visualization showing:
- 5 stages: Cliques → Visita na Página → Initiate Checkout → Vendas Iniciadas → Vendas Aprovadas
- Each stage as a horizontal bar that narrows proportionally
- Stage name on the left, value in the middle, percentage on the right
- Conversion rate arrows between stages
- Clean, flat design with subtle color coding per stage

**Section 4 — Payment Breakdown (right 40%, below strip, next to funnel):**
A donut chart showing sales by payment method (PIX, Cartão, Boleto, Outros) with:
- Large center number showing total sales count
- Legend below with colored dots and labels
- Percentage breakdown

**Section 5 — Revenue vs Spend Chart (full width, below funnel):**
A sleek area chart comparing daily revenue vs ad spend over time:
- Two overlapping areas with different colors (green for revenue, red/pink for spend)
- Time range selector: 7 dias, 14 dias, 30 dias, 90 dias, Ano
- Summary stats above chart: Receita total, Gasto total, ROAS
- Clean, minimal axis labels, smooth curves

**Section 6 — Recent Activity (full width, below chart):**
A compact activity feed showing recent events:
- Each item has: icon (sale/pending/refund), customer name, product name, amount, time ago
- Scrollable list with max 5 visible items
- "Ver todas as vendas" link at bottom

Style: Clean, minimal, enterprise-grade but with warmth. White background (#ffffff) with very subtle gray cards (#f8fafc). Orange accent color (#f97316) for primary actions and active states. Deep slate text (#0f172a). Modern sans-serif typography (Inter or similar). Subtle shadows (shadow-sm). Rounded corners (rounded-2xl). Smooth micro-interactions on hover.

The overall layout should be asymmetric and dynamic — NOT a simple 4-column grid of equal cards. The hero card should dominate, the funnel and payment chart should sit side by side, and the chart should be wide and immersive.

Optimize for desktop-first. Mobile should stack everything vertically in a single column.

---

<!-- Component: Revenue Hero Card -->
Design a wide, prominent hero card for the top of a financial dashboard.

Include:
- Full-width card with white background and subtle border
- Left section (50% width): "Faturamento Hoje" label in small muted text, large bold number "R$ 0,00" below it, and a tiny sparkline (7-day trend) rendered as a thin line below the number
- Center section (30% width): 3 compact stats in a vertical stack: "Vendas: 0", "Ticket Médio: R$ 0", "ROI: 0.0x" — each with small label and bold value
- Right section (20% width): A circular progress ring (thin stroke, animated on load) showing daily goal progress, with percentage in the center

Style: Clean, prominent, slightly larger than other cards. Use shadow-md for depth. The sparkline should be a smooth SVG curve. The progress ring should animate from 0 to current value on mount.

---

<!-- Component: Performance Strip -->
Design a horizontal strip of compact metric pills for a dashboard.

Include:
- 6 pills in a single horizontal row, evenly spaced
- Each pill contains: metric name (10px, uppercase, muted), value (16px, bold), delta indicator (small badge with arrow + percentage), and a tiny sparkline (40px wide)
- Metrics: Faturamento Líquido (R$), Gasto com Anúncios (R$), ROAS (Xx), Lucro Líquido (R$), Margem de Lucro (%), Chargeback (%)
- Delta badges: green background for positive, red background for negative, with arrow icon
- Sparklines: thin 2px lines showing 7-day trend, colored to match the metric's sentiment

Style: Compact, information-dense. Each pill has a very subtle background (#f1f5f9). No heavy borders — use spacing and background color to separate. The strip should feel like a "ticker" of key metrics.

---

<!-- Component: Conversion Funnel -->
Design a modern conversion funnel visualization for a marketing dashboard.

Include:
- 5 horizontal stages stacked vertically, each progressively narrower
- Each stage shows: stage number (01-05) with colored circle icon, stage name, description text, a colored bar (width proportional to value), value number, conversion rate from previous stage, and cumulative conversion rate
- Stages: 01 Cliques (blue), 02 Visita na Página (purple), 03 Initiate Checkout (pink), 04 Vendas Iniciadas (orange), 05 Vendas Aprovadas (green)
- Between stages: small arrow with conversion rate percentage
- Bottom: 5 compact cards showing conversion rates between each adjacent pair + overall conversion
- The bar widths should create a visual funnel shape — wide at top, narrow at bottom

Style: Clean, modern. Each stage has a white background with subtle left border in the stage color. The bars should be solid colored rectangles. Icons should be from Lucide icon set. Numbers should be bold and prominent.

---

<!-- Component: Revenue vs Spend Area Chart -->
Design a sleek area chart comparing revenue vs ad spend over time.

Include:
- Full-width chart with two overlapping filled areas
- Green area for Revenue (higher opacity, smooth curve)
- Red/pink area for Spend (lower opacity, smooth curve)
- Time range selector buttons above chart: 7 dias, 14 dias, 30 dias, 90 dias, Ano (30 dias selected by default)
- Summary stats above the selector: Receita (green), Gasto (red), ROAS (bold)
- Clean X-axis with date labels, minimal Y-axis with currency labels
- Hover tooltip showing exact values for both metrics on that day
- Legend at bottom: green dot + "Receita", red dot + "Gasto"

Style: Clean, minimal. No grid lines — use subtle horizontal rules at Y-axis intervals. Smooth bezier curves for the areas. The chart should feel immersive and wide. Use Recharts-style rendering with gradient fills.

---

<!-- Component: Recent Activity Feed -->
Design a compact activity feed showing recent sales events.

Include:
- Header "Atividade Recente" with a "Ver todas" link
- 5 visible items in a scrollable list
- Each item: left icon (green check for paid, yellow clock for pending, red X for refunded), customer name (bold), product name (muted), amount (bold, colored by status), time ago (muted, right-aligned)
- Bottom: "Ver todas as vendas →" link
- Empty state: illustration + "Nenhuma atividade recente" message

Style: Compact, clean. Each item separated by subtle divider. Icons in small colored circles. The feed should feel like a real-time stream of events. Max height with overflow scroll.
