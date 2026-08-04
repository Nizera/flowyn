import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAppUrl } from '@/lib/app-url'

/**
 * GET /api/producer-script
 * Gera um script leve de rastreamento UTM para produtores colarem em suas landing pages.
 *
 * O script:
 * 1) Captura UTMs da URL da landing page
 * 2) Salva em cookie first-party (_fl_utm)
 * 3) Injeta UTMs + click IDs nos links /r/ (CTAs para o checkout Flowyn)
 * 4) Funciona independente de qualquer outro script (inline, resistente a ad blockers)
 *
 * Query params:
 *   ?user_id=UUID  — opcional, retorna script para produtor específico
 *   (se omitido, usa o user logado)
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const targetUserId = searchParams.get('user_id') || user.id
  const appUrl = getAppUrl()

  const js = buildProducerScript(targetUserId, appUrl)

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

function buildProducerScript(userId: string, appUrl: string): string {
  return `/* FlowynPay Producer UTM Script — user=${userId} */
(function(){
  "use strict";
  if (window.__fl_producer_script) return;
  window.__fl_producer_script = true;

  var APP = ${JSON.stringify(appUrl)};
  var UTM_KEYS = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","src","sck"];
  var CLICK_KEYS = ["fbclid","ttclid","gclid"];
  var ALL_KEYS = UTM_KEYS.concat(CLICK_KEYS);

  function getCookie(n){
    var m = document.cookie.match(new RegExp("(^|; )"+n+"=([^;]*)"));
    return m ? decodeURIComponent(m[2]) : null;
  }
  function setCookie(n,v,days){
    var exp = new Date();
    exp.setTime(exp.getTime() + days*864e5);
    document.cookie = n+"="+encodeURIComponent(v)+"; expires="+exp.toUTCString()+"; path=/; SameSite=Lax; Secure";
  }

  // 1. Lê UTMs da URL atual
  var params = new URLSearchParams(location.search);
  var utms = {};
  var hasUrl = false;
  for (var i = 0; i < ALL_KEYS.length; i++) {
    var v = params.get(ALL_KEYS[i]);
    if (v) { utms[ALL_KEYS[i]] = v; hasUrl = true; }
  }

  // 2. Fallback: lê do cookie _fl_utm (visitas anteriores)
  if (!hasUrl) {
    var stored = getCookie("_fl_utm");
    if (stored) {
      try { utms = JSON.parse(stored); } catch(e) {}
    }
  }

  // 3. Se tem UTMs (URL ou cookie), salva e injeta nos CTAs
  if (Object.keys(utms).length > 0) {
    setCookie("_fl_utm", JSON.stringify(utms), 30);

    // Monta query string para injetar
    var qs = "";
    for (var k in utms) {
      if (utms.hasOwnProperty(k) && utms[k]) {
        qs += (qs ? "&" : "") + encodeURIComponent(k) + "=" + encodeURIComponent(utms[k]);
      }
    }

    // Lê _fbp/_fbc do browser
    var fbp = getCookie("_fbp");
    var fbc = getCookie("_fbc");
    if (fbp) qs += "&_fbp=" + encodeURIComponent(fbp);
    if (fbc) qs += "&_fbc=" + encodeURIComponent(fbc);

    // Injeta em todos os links /r/ da Flowyn
    var links = document.querySelectorAll('a[href*="/r/"]');
    for (var i = 0; i < links.length; i++) {
      try {
        var url = new URL(links[i].href);
        var changed = false;
        for (var k in utms) {
          if (utms.hasOwnProperty(k) && utms[k] && !url.searchParams.has(k)) {
            url.searchParams.set(k, utms[k]);
            changed = true;
          }
        }
        if (fbp && !url.searchParams.has("_fbp")) { url.searchParams.set("_fbp", fbp); changed = true; }
        if (fbc && !url.searchParams.has("_fbc")) { url.searchParams.set("_fbc", fbc); changed = true; }
        if (changed) links[i].href = url.toString();
      } catch(e) {}
    }
  }

  // 4. MutationObserver: injeta UTMs em links adicionados dinamicamente
  if (typeof MutationObserver !== "undefined" && Object.keys(utms).length > 0) {
    var observer = new MutationObserver(function(mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var nodes = mutations[m].addedNodes;
        for (var n = 0; n < nodes.length; n++) {
          var node = nodes[n];
          if (node.nodeType !== 1) continue;
          var el = node.matches && node.matches('a[href*="/r/"]') ? node : null;
          if (!el && node.querySelectorAll) {
            var found = node.querySelectorAll('a[href*="/r/"]');
            for (var j = 0; j < found.length; j++) injectLink(found[j]);
          }
          if (el) injectLink(el);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function injectLink(a) {
    try {
      var url = new URL(a.href);
      var changed = false;
      for (var k in utms) {
        if (utms.hasOwnProperty(k) && utms[k] && !url.searchParams.has(k)) {
          url.searchParams.set(k, utms[k]);
          changed = true;
        }
      }
      var fbp = getCookie("_fbp");
      var fbc = getCookie("_fbc");
      if (fbp && !url.searchParams.has("_fbp")) { url.searchParams.set("_fbp", fbp); changed = true; }
      if (fbc && !url.searchParams.has("_fbc")) { url.searchParams.set("_fbc", fbc); changed = true; }
      if (changed) a.href = url.toString();
    } catch(e) {}
  }

  // 5. Expose helper para debug
  window.__fl_get_utms = function() { return utms; };
})();`
}
