import sys
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

input_file = sys.argv[1] if len(sys.argv) > 1 else "carousel-vantagens-parceria.html"
INPUT_HTML = Path(input_file).resolve()
output_name = INPUT_HTML.stem
OUTPUT_DIR = (Path("slides_export") / output_name).resolve()
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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
            if (frame) {
                frame.style.cssText = 'width:420px;height:525px;max-width:none;border-radius:0;box-shadow:none;overflow:hidden;margin:0;';
            }

            const viewport = document.querySelector('.carousel-viewport');
            if (viewport) {
                viewport.style.cssText = 'width:420px;height:525px;aspect-ratio:unset;overflow:hidden;cursor:default;';
            }

            document.body.style.cssText = 'padding:0;margin:0;display:block;overflow:hidden;';
        }""")
        await page.wait_for_timeout(500)

        total_slides = await page.evaluate("() => document.querySelectorAll('.carousel-slide').length")
        if not total_slides:
            total_slides = 7

        for i in range(total_slides):
            await page.evaluate("""(idx) => {
                const track = document.querySelector('.carousel-track');
                if (track) {
                    track.style.transition = 'none';
                    track.style.transform = 'translateX(' + (-idx * 420) + 'px)';
                }
            }""", i)
            await page.wait_for_timeout(400)

            await page.screenshot(
                path=str(OUTPUT_DIR / f"slide_{i+1}.png"),
                clip={"x": 0, "y": 0, "width": VIEW_W, "height": VIEW_H}
            )
            print(f"Exported slide {i+1}/{total_slides}")

        await browser.close()

asyncio.run(export_slides())
