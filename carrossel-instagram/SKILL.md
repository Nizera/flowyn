---
name: flowyn-instagram-carousel
description: >
  Cria carrosséis e posts de alta qualidade para o Instagram da Flowyn como
  previews HTML deslizáveis com slides prontos para exportação (1080×1350px PNG).
  A identidade da marca Flowyn já está pré-configurada — nunca pergunte sobre
  cores, fontes ou logotipo. Acione este skill sempre que o usuário pedir para
  criar, desenhar ou gerar um carrossel, post, slides para Instagram ou qualquer
  conteúdo multi-imagem para a Flowyn — mesmo que não diga explicitamente
  "carrossel" ou "skill". Também acione para "fazer carrossel", "criar post",
  "exportar slides" ou "conteúdo para o Instagram da Flowyn".
---

# Flowyn — Gerador de Carrossel para Instagram

Gera carrosséis HTML auto-contidos e deslizáveis onde cada slide é projetado
para exportação como PNG individual de 1080×1350px para o Instagram da Flowyn.

---

## 🏢 Contexto: O que é a Flowyn

**Flowyn** (`flowyn.com.br`) é uma plataforma SaaS de afiliados focada em
produtores de Micro SaaS e SaaS. Funciona como Hotmart/Braip, mas especializada
em software:

- **Produtores** cadastram seus SaaS, definem preços e comissões de afiliados
- **Afiliados** promovem os produtos e ganham comissão recorrente por venda
- **Checkout proprietário** com split de pagamento automático via Stripe Connect
- **Integração No-Code** via Make.com / Zapier — webhook dispara `purchase.created` e provisiona acesso no SaaS do produtor automaticamente
- **Dashboard de MRR** em tempo real para produtores e afiliados
- **Tagline:** *"O Fluxo de Vendas Perfeito para o seu SaaS"*

**Públicos-alvo dos carrosséis:**
- Fundadores de Micro SaaS e SaaS que querem vender sem anúncios
- Desenvolvedores e criadores de produtos digitais
- Afiliados que querem renda passiva recorrente
- Empreendedores digitais brasileiros

---

## Step 1: O que perguntar antes de gerar

**A identidade visual da Flowyn já está pré-configurada abaixo — NUNCA pergunte
sobre marca, cores, fontes ou logotipo.**

Antes de gerar, pergunte apenas:

1. **Tema do carrossel** — qual assunto/ângulo será abordado
2. **Formato** — padrão (7 slides), listicle, tutorial ou comparação (ver seções abaixo)
3. **Imagens** — screenshots do produto, print de resultados, ou nenhuma (opcional)

Se o usuário disser "faz um carrossel sobre X" sem mais detalhes, gere direto
usando o formato padrão de 7 slides. **Não bloqueie pedindo aprovação prévia de
brand — a marca já está definida.**

---

## Handling User-Provided Images

**This section applies from the very first HTML generation — not only during export.**

When the user provides an image file path (e.g., `/home/user/gestante.png`, `/mnt/user-data/uploads/foto.jpg`):

### ⚠️ Critical Rules

1. **NEVER use relative paths** (`gestante.png`) — they break in every browser context except the exact folder the HTML lives in.
2. **NEVER use `background: url(filepath)`** — leads to 1.5MB+ base64 inline strings that crash the browser parser.
3. **ALWAYS embed as base64 `data:` URI** — works in preview, export, and any environment.
4. **ALWAYS generate the HTML via Python** (`Path.write_text()`) — shell heredocs interpolate `$` and backticks, corrupting base64 strings.

### Step-by-step: embed an image

```bash
# 1. Check the actual file format (extension may lie)
file /path/to/image.png
```

```python
import base64
from pathlib import Path

# 2. Read and encode
img_path = Path("/path/to/image.png")
# Use "image/jpeg" if `file` command says JPEG, else "image/png"
mime = "image/jpeg"  # or "image/png"
b64 = base64.b64encode(img_path.read_bytes()).decode()
data_uri = f"data:{mime};base64,{b64}"

# 3. Inject into HTML template as a Python variable — never via shell
html = f"""
<div style="position:relative;width:100%;height:100%;">
  <img src="{data_uri}"
       style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;">
  <div style="position:absolute;inset:0;background:rgba(255,255,255,0.35);z-index:1;"></div>
  <!-- slide content goes here, z-index:2 -->
</div>
"""

Path("/home/claude/carousel.html").write_text(html, encoding="utf-8")
```

### Image as slide background (most common use)

```html
<!-- Inside the slide div, before any content -->
<img src="{data_uri}"
     style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;">
<!-- Semi-transparent overlay so text stays readable -->
<div style="position:absolute;inset:0;background:rgba(255,255,255,0.35);z-index:1;"></div>
<!-- All slide content must have z-index:2 or higher -->
```

For dark slides, use `rgba(0,0,0,0.45)` as the overlay instead.

### Common image mistakes to avoid

| Mistake | What goes wrong | Fix |
|---------|----------------|-----|
| `<img src="gestante.png">` | Broken image — relative path only works if HTML and image share the same folder | Always use base64 `data:` URI |
| `background: url('data:...')` inline with 1.5MB base64 | Browser parser crash, 1.3M token context | Use `<img>` tag with `object-fit:cover` |
| Generating HTML via shell `echo` or heredoc | `$` and backtick characters in base64 get interpolated and corrupt the string | Always use Python `Path.write_text()` |
| Assuming `.png` extension = PNG format | File may actually be JPEG; wrong MIME type breaks rendering | Run `file` command to detect actual format |

---

## Step 2: Sistema de Cores da Flowyn (Pré-configurado)

**Não derive nem invente — use sempre estes tokens fixos da Flowyn:**

```
BRAND_PRIMARY   = #00e88a   // Verde neon — barra de progresso, ícones, tags
BRAND_LIGHT     = #00f594   // Verde claro — pills em slides escuros, hover
BRAND_DARK      = #00b86e   // Verde escuro — âncora de gradiente, texto em CTA
LIGHT_BG        = #fafaf8   // Off-white quente — fundo de slides claros
LIGHT_BORDER    = #f2f0eb   // Divisores em slides claros
DARK_BG         = #0a0a0a   // Preto profundo com leve tom quente — slides escuros
```

**Gradiente de marca:** `linear-gradient(165deg, #00b86e 0%, #00e88a 50%, #00f594 100%)`

**Regras de uso:**
- Slides claros: fundo `#fafaf8`, texto `#0a0a0a`, acento `#00e88a`
- Slides escuros: fundo `#0a0a0a`, texto `#fafaf8`, acento `#00e88a`
- Slides gradiente (Hero/CTA): gradiente acima como background, texto `#fafaf8`
- Nunca use branco puro (`#ffffff`) nem preto puro (`#000000`)

---

## Step 3: Tipografia da Flowyn (Pré-configurada)

**Use sempre estas fontes — nunca substitua por outras sem instrução explícita:**

| Papel | Fonte | Peso | Uso |
|-------|-------|------|-----|
| Display / Título | **Syne** | 700, 800 | Headings, números grandes, logo |
| Corpo / Interface | **DM Sans** | 300, 400, 500 | Body text, tags, labels, captions |

**Import Google Fonts (sempre incluir no `<head>`):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
```

**Escala de tamanhos (fixa para a Flowyn):**
- Headings: 28–36px, Syne weight 800, letter-spacing -1 a -1.5px, line-height 1.05–1.1
- Body: 14px, DM Sans weight 300/400, line-height 1.55
- Tags/labels: 10px, DM Sans weight 500, letter-spacing 2px, uppercase
- Números de passo: Syne 26px, weight 800
- Small text: 11–12px, DM Sans weight 400

Aplique via classes CSS `.serif` (Syne) e `.sans` (DM Sans) em todos os slides.

**CSS base obrigatório:**
```css
.serif { font-family: 'Syne', sans-serif; }
.sans  { font-family: 'DM Sans', sans-serif; }
```

---

## Slide 1 — Regras de Hook (para o público da Flowyn)

O primeiro slide deve parar o scroll em menos de 1 segundo. Priorize estes formatos para o nicho SaaS/afiliados:

| Formato de Hook | Exemplo Flowyn |
|---|---|
| Afirmação polêmica | "Você não precisa de anúncios para vender seu SaaS" |
| Número + benefício | "5 formas de ter afiliados promovendo seu produto em 24h" |
| Pergunta que dói | "Por que seu SaaS ainda não tem um programa de afiliados?" |
| Resultado concreto | "R$12.800 de MRR sem gastar R$1 em mídia paga" |
| Inversão de expectativa | "Quanto mais afiliados, menos você trabalha" |
| Comparação de status | "Hotmart é para infoprodutos. Flowyn é para SaaS." |

**Regras:**
- Nunca comece com o nome da marca como headline
- Use prova visual no Slide 1 sempre que possível (print de dashboard, número real, resultado)
- O hook deve prometer o valor que os slides seguintes entregam
- Idioma: **Português (BR)** sempre, a não ser que explicitamente solicitado em outro idioma

---

## Slide Sequences

### Standard (7 slides — default)

| # | Type | Background | Purpose |
|---|------|------------|---------|
| 1 | Hero | LIGHT_BG | Hook — bold statement, logo lockup, optional watermark |
| 2 | Problem | DARK_BG | Pain point — what's broken, frustrating, or outdated |
| 3 | Solution | Brand gradient | The answer — what solves it, optional quote/prompt box |
| 4 | Features | LIGHT_BG | What you get — feature list with icons |
| 5 | Details | DARK_BG | Depth — customization, specs, differentiators |
| 6 | How-to | LIGHT_BG | Steps — numbered workflow or process |
| 7 | CTA | Brand gradient | Call to action — logo, tagline, CTA button. **No arrow. Full progress bar.** |

### Listicle (5–10 slides)

| # | Type | Background |
|---|------|------------|
| 1 | Hero | LIGHT_BG |
| 2–N | Item N | Alternating LIGHT/DARK |
| Last | CTA | Brand gradient |

Use for: "X ferramentas", "X erros", "X dicas"

### Tutorial (7 slides)

| # | Type | Background |
|---|------|------------|
| 1 | Hero | LIGHT_BG |
| 2 | Contexto / Por quê | DARK_BG |
| 3–5 | Passo 1, 2, 3 | Alternating |
| 6 | Resultado esperado | DARK_BG |
| 7 | CTA | Brand gradient |

### Comparação (5 slides)

| # | Type | Background |
|---|------|------------|
| 1 | Hero (o que será comparado) | LIGHT_BG |
| 2 | Opção A | LIGHT_BG |
| 3 | Opção B | DARK_BG |
| 4 | Veredicto | Brand gradient |
| 5 | CTA | DARK_BG |

**General rules for all sequences:**
- Start with a hook — first slide must stop the scroll
- End CTA on brand gradient — no swipe arrow, progress bar at 100%
- Alternate light and dark backgrounds for visual rhythm
- Adapt sequence to topic — not every carousel needs all slides

---

## Slide Architecture

### Format
- Aspect ratio: **4:5** (Instagram carousel standard)
- Each slide is self-contained — all UI elements baked into the image
- Alternate LIGHT_BG and DARK_BG backgrounds for visual rhythm

### Required Elements on Every Slide

#### 1. Progress Bar (bottom of every slide)

Shows position in the carousel. Fills as user swipes.

- Position: absolute bottom, full width, 28px horizontal padding, 20px bottom padding
- Track: 3px height, rounded corners
- Fill width: `((slideIndex + 1) / totalSlides) * 100%`
- Light slides: `rgba(0,0,0,0.08)` track, `BRAND_PRIMARY` fill, `rgba(0,0,0,0.3)` counter
- Dark slides: `rgba(255,255,255,0.12)` track, `#fff` fill, `rgba(255,255,255,0.4)` counter
- Counter label beside the bar: "1/7" format, 11px, weight 500

```javascript
function progressBar(index, total, isLightSlide) {
  const pct = ((index + 1) / total) * 100;
  const trackColor = isLightSlide ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
  const fillColor = isLightSlide ? BRAND_PRIMARY : '#fff'; // use actual BRAND_PRIMARY value
  const labelColor = isLightSlide ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)';
  return `<div style="position:absolute;bottom:0;left:0;right:0;padding:16px 28px 20px;z-index:10;display:flex;align-items:center;gap:10px;">
    <div style="flex:1;height:3px;background:${trackColor};border-radius:2px;overflow:hidden;">
      <div style="height:100%;width:${pct}%;background:${fillColor};border-radius:2px;"></div>
    </div>
    <span style="font-size:11px;color:${labelColor};font-weight:500;">${index + 1}/${total}</span>
  </div>`;
}
```

⚠️ **Important:** Always replace `BRAND_PRIMARY` with the actual hex value before rendering. Never leave it as a variable name in the HTML output.

#### 2. Swipe Arrow (right edge — every slide EXCEPT the last)

Subtle chevron guiding the user to keep swiping. Removed on the last slide.

- Position: absolute right, full height, 48px wide
- Background: gradient fade transparent → subtle tint
- Chevron: 24×24 SVG, rounded strokes
- Light slides: `rgba(0,0,0,0.06)` bg, `rgba(0,0,0,0.25)` stroke
- Dark slides: `rgba(255,255,255,0.08)` bg, `rgba(255,255,255,0.35)` stroke

```javascript
function swipeArrow(isLightSlide) {
  const bg = isLightSlide ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
  const stroke = isLightSlide ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.35)';
  return `<div style="position:absolute;right:0;top:0;bottom:0;width:48px;z-index:9;display:flex;align-items:center;justify-content:center;background:linear-gradient(to right,transparent,${bg});">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M9 6l6 6-6 6" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>`;
}
```

---

## Reusable Components

### Strikethrough pills
```html
<span style="font-size:11px;padding:5px 12px;border:1px solid rgba(255,255,255,0.1);border-radius:20px;color:#6B6560;text-decoration:line-through;">{Old tool}</span>
```

### Tag pills
```html
<span style="font-size:11px;padding:5px 12px;background:rgba(255,255,255,0.06);border-radius:20px;color:{BRAND_LIGHT};">{Label}</span>
```

### Prompt / quote box
```html
<div style="padding:16px;background:rgba(0,0,0,0.15);border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
  <p class="sans" style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:6px;">{Label}</p>
  <p class="serif" style="font-size:15px;color:#fff;font-style:italic;line-height:1.4;">"{Quote text}"</p>
</div>
```

### Feature list
```html
<div style="display:flex;align-items:flex-start;gap:14px;padding:10px 0;border-bottom:1px solid {LIGHT_BORDER};">
  <span style="color:{BRAND_PRIMARY};font-size:15px;width:18px;text-align:center;">{icon}</span>
  <div>
    <span class="sans" style="font-size:14px;font-weight:600;color:{DARK_BG};">{Label}</span>
    <span class="sans" style="font-size:12px;color:#8A8580;">{Description}</span>
  </div>
</div>
```

### Numbered steps
```html
<div style="display:flex;align-items:flex-start;gap:16px;padding:14px 0;border-bottom:1px solid {LIGHT_BORDER};">
  <span class="serif" style="font-size:26px;font-weight:300;color:{BRAND_PRIMARY};min-width:34px;line-height:1;">01</span>
  <div>
    <span class="sans" style="font-size:14px;font-weight:600;color:{DARK_BG};">{Step title}</span>
    <span class="sans" style="font-size:12px;color:#8A8580;">{Step description}</span>
  </div>
</div>
```

### Color swatches
```html
<div style="width:32px;height:32px;border-radius:8px;background:{color};border:1px solid rgba(255,255,255,0.08);"></div>
```

### CTA button (final slide only)
```html
<div style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;background:#fafaf8;color:#00b86e;font-family:'DM Sans',sans-serif;font-weight:600;font-size:14px;border-radius:28px;">
  {CTA text} →
</div>
```

**CTAs padrão da Flowyn para o slide final:**
- `"Crie sua conta grátis →"` (produtores)
- `"Quero ser afiliado →"` (afiliados)
- `"flowyn.com.br →"` (awareness geral)
- `"Comece em 3 minutos →"` (urgência)

### Tag / Category Label
```html
<span class="sans" style="display:inline-block;font-size:10px;font-weight:500;letter-spacing:2px;color:{color};margin-bottom:16px;">{TAG TEXT}</span>
```
- Slides claros: `#00e88a`
- Slides escuros: `#00f594`
- Slides gradiente: `rgba(255,255,255,0.6)`

**Tags padrão da Flowyn:** `FLOWYN` · `SAAS` · `AFILIADOS` · `MRR` · `NO-CODE` · `MAKE.COM`

### Logo Lockup da Flowyn (primeiro e último slides)

Sempre use este padrão — nunca improvise um logo diferente:

```html
<!-- Logo Flowyn: ponto verde + wordmark -->
<div style="display:flex;align-items:center;gap:8px;">
  <div style="width:8px;height:8px;border-radius:50%;background:#00e88a;"></div>
  <span class="serif" style="font-size:14px;font-weight:800;letter-spacing:-0.5px;color:{TEXT_COLOR};">Flowyn</span>
</div>
```
- Slides claros: `color:#0a0a0a`
- Slides escuros e gradiente: `color:#fafaf8`

---

## Layout Rules

- Content padding: `0 36px` standard
- Bottom-aligned slides with progress bar: `0 36px 52px` to clear the bar
- **Hero/CTA slides:** `justify-content: center`
- **Content-heavy slides:** `justify-content: flex-end`
- **Content must never overlap the progress bar** — use `padding-bottom: 52px`

---

## Instagram Frame (Preview Wrapper)

Ao exibir no chat, envolva em um frame estilo Instagram **pré-configurado para a Flowyn**:

- **Header:** Avatar (círculo `#00e88a` com ponto branco) + handle `@flowyn` + subtítulo `"flowyn.com.br"`
- **Viewport:** proporção 4:5, track deslizável/arrastável com todos os slides
- **Dots:** Indicadores de ponto pequenos abaixo do viewport
- **Actions:** ícones SVG de coração, comentário, compartilhar, salvar
- **Caption:** `flowyn` + descrição curta do carrossel + timestamp `"AGORA"`

Inclua interação de swipe/drag baseada em pointer para preview. Os slides ainda são imagens individuais prontas para exportação.

**Importante:** `.ig-frame` deve ter exatamente **420px de largura**. O viewport do carrossel é 420×525px. NÃO altere esta largura — a exportação depende disso.

---

## Review Flow

**Always follow this flow. Never skip to export without approval.**

1. Generate the HTML preview first — never jump directly to export
2. Show the preview and ask: **"Quais slides precisam de ajuste antes de exportar?"**
3. Fix only the mentioned slides — never regenerate the entire carousel unless the direction fundamentally changes
4. Only proceed to export when the user explicitly confirms approval (e.g., "pode exportar", "aprovado", "ok")

---

## Exporting Slides as Instagram-Ready PNGs

After the user approves the carousel preview, export each slide as an individual **1080×1350px PNG**.

### Critical Export Rules

1. **Use Python for HTML generation** — never use shell scripts with variable interpolation. Always use `Path.write_text()` or `open().write()`.

2. **Embed images as base64** — all user-uploaded images must be base64-encoded as `data:image/jpeg;base64,...` URIs. Check actual file format with the `file` command — a `.png` extension may contain a JPEG.

3. **Keep the 420px layout width** — use Playwright's `device_scale_factor` to scale up to 1080px output WITHOUT changing the layout viewport.

### Install Playwright (only if needed)

Before running the export script, check and install only if missing:

```bash
python3 -c "import playwright" 2>/dev/null || pip3 install playwright
python3 -c "from playwright.sync_api import sync_playwright; sync_playwright().__enter__().chromium" 2>/dev/null || python3 -m playwright install chromium
```

### Export Script

```python
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

INPUT_HTML = Path("/path/to/carousel.html")
OUTPUT_DIR = Path("/path/to/output/slides")
OUTPUT_DIR.mkdir(exist_ok=True)

TOTAL_SLIDES = 7  # Update to match your carousel

VIEW_W = 420
VIEW_H = 525
SCALE = 1080 / 420  # = 2.5714...

async def export_slides():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(
            viewport={"width": VIEW_W, "height": VIEW_H},
            device_scale_factor=SCALE,
        )

        html_content = INPUT_HTML.read_text(encoding="utf-8")
        await page.set_content(html_content, wait_until="networkidle")
        await page.wait_for_timeout(3000)  # Wait for Google Fonts to load

        # Hide IG frame chrome, show only the slide viewport
        await page.evaluate("""() => {
            document.querySelectorAll('.ig-header,.ig-dots,.ig-actions,.ig-caption')
                .forEach(el => el.style.display='none');

            const frame = document.querySelector('.ig-frame');
            frame.style.cssText = 'width:420px;height:525px;max-width:none;border-radius:0;box-shadow:none;overflow:hidden;margin:0;';

            const viewport = document.querySelector('.carousel-viewport');
            viewport.style.cssText = 'width:420px;height:525px;aspect-ratio:unset;overflow:hidden;cursor:default;';

            document.body.style.cssText = 'padding:0;margin:0;display:block;overflow:hidden;';
        }""")
        await page.wait_for_timeout(500)

        for i in range(TOTAL_SLIDES):
            await page.evaluate("""(idx) => {
                const track = document.querySelector('.carousel-track');
                track.style.transition = 'none';
                track.style.transform = 'translateX(' + (-idx * 420) + 'px)';
            }""", i)
            await page.wait_for_timeout(400)

            await page.screenshot(
                path=str(OUTPUT_DIR / f"slide_{i+1}.png"),
                clip={"x": 0, "y": 0, "width": VIEW_W, "height": VIEW_H}
            )
            print(f"Exported slide {i+1}/{TOTAL_SLIDES}")

        await browser.close()

asyncio.run(export_slides())
```

### Why This Works

- **`device_scale_factor=2.5714`** renders at high DPI — a 420px element becomes 1080px in the output. Layout stays at 420px.
- **`clip`** captures only the carousel viewport, not browser chrome.
- **`wait_for_timeout(3000)`** gives Google Fonts time to load.
- **`track.style.transition = 'none'`** disables swipe animation so slides snap instantly.

### Common Export Mistakes to Avoid

| Mistake | What goes wrong | Fix |
|---------|----------------|-----|
| Setting viewport to 1080×1350 | Layout reflows — fonts tiny, spacing breaks | Keep viewport at 420×525, use `device_scale_factor` |
| Using shell scripts to generate HTML | `$` signs and backticks get interpolated | Always use Python for HTML generation |
| Not waiting for fonts | Headings render in fallback system fonts | `wait_for_timeout(3000)` after page load |
| Not hiding IG frame chrome | Export includes header, dots, caption | Hide `.ig-header,.ig-dots,.ig-actions,.ig-caption` |
| Changing `.ig-frame` width | Entire layout shifts | Always keep at exactly 420px |
| Leaving `BRAND_PRIMARY` as variable name in CSS | Color renders as invalid / invisible | Always interpolate actual hex values into HTML |

---

## Design Principles

1. **Every slide is export-ready** — arrow and progress bar are part of the slide image
2. **Light/dark alternation** — creates visual rhythm across swipes
3. **Heading + body font pairing** — display font for impact, body for readability
4. **Brand-derived palette** — all colors stem from one primary, keeping everything cohesive
5. **Progressive disclosure** — progress bar fills and arrow guides forward
6. **Last slide is special** — no arrow, full progress bar, clear CTA
7. **Consistent components** — same tag style, list style, spacing across all slides
8. **Content padding clears UI** — body text never overlaps progress bar or arrow
9. **Hook-first copy** — Slide 1 exists to stop the scroll, not to introduce the brand
10. **Iterate fast** — show preview, fix specific slides, don't rebuild from scratch
