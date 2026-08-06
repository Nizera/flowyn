import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getAppUrl } from '@/lib/app-url'

// Serve o tracker.js customizado para cada pixel (lookup pelo public_token).
// URL publica: https://flowyn.com/t/PUBLIC_TOKEN.js
// Produtor cola no HTML da landing externa: <script src="https://flowyn.com/t/UUID.js" async></script>
//
// O script:
// 1) Gera session_id (uuid v4) e salva em first-party cookie (_fl_sid), 30 dias
// 2) Captura UTMs da URL atual (+ fbclid/ttclid/gclid)
// 3) Dispara fbq('init', PIXEL_ID), fbq('track','PageView')
// 4) beacon POST /api/tr/track (server-side fallback para bypass ad blockers)
// 5) Intercepta clicks em <a href*="/checkout/...">  e injeta ?utm_...=&fl_sid= na URL
//    antes de redirecionar para o checkout da Flowyn (preserva cross-domain)
//
// Importante: PIXEL_ID real da Meta aparece no JS no browser. É semi-public
// (pixel IDs sempre aparecem no client). Token public_token é o que vincula ao
// nosso DB — não expõe o pixel_id encriptado (que é server-only).

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await ctx.params

  // Strip .js extension (URL pattern: /t/UUID.js)
  const token = rawToken.replace(/\.js$/i, '')

  // Validate UUID
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return new NextResponse('not found', { status: 404 })
  }

  const supabase = createAdminClient()
  const { data: pixel } = await supabase
    .from('pixels')
    .select('id, pixel_id, is_active, platform')
    .eq('public_token', token)
    .eq('platform', 'meta')
    .maybeSingle()

  if (!pixel || !pixel.is_active) {
    return new NextResponse('not found', { status: 404 })
  }

  // pixel_id está encriptado no DB com AES-256-GCM — não expomos aqui. O tracker.js
  // não usa pixel_id da Meta (ele só usa fbq via PixelScripts injetado no checkout);
  // faz apenas: a) registrar page_view server-side, b) preservar UTMs no redirect.
  // Para suporte a pixel client-side na landing externa, o produtor deve colar
  // também o snippet oficial `<!-- Meta Pixel Code -->` da Meta diretamente no HTML.
  // Escopo dessa entrega: tracking server-side + UTM preservation.

  const appUrl = getAppUrl()
  const js = buildTrackerJs(token, appUrl)

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=60, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function buildTrackerJs(publicToken: string, appUrl: string): string {
  return `/* FlowynPay cross-domain tracker v1 — public_token=${publicToken} */
(function(){
  "use strict";
  if (window.__fl_tracker) return;
  window.__fl_tracker = true;

  var TOKEN = ${JSON.stringify(publicToken)};
  var ENDPOINT = ${JSON.stringify(appUrl)} + "/api/tr/track";
  var APP_ORIGIN = ${JSON.stringify(appUrl)};

  var UTM_KEYS = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","src","sck"];
  var CLICK_KEYS = ["fbclid","ttclid","gclid"];

  function uuidv4(){
    try {
      return crypto.randomUUID();
    } catch(e){
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c){
        var r = Math.random()*16|0, v = c === "x" ? r : (r&0x3|0x8);
        return v.toString(16);
      });
    }
  }

  function getCookie(name){
    var match = document.cookie.match(new RegExp("(^|; )"+name+"=([^;]*)"));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function setCookie(name, value, days){
    var d = new Date();
    d.setTime(d.getTime() + days*24*60*60*1000);
    document.cookie = name+"="+encodeURIComponent(value)+"; expires="+d.toUTCString()+"; path=/; SameSite=Lax; Secure";
  }

  // Session ID — first-party cookie, 30 dias
  var SID = getCookie("_fl_sid");
  if (!SID) { SID = uuidv4(); setCookie("_fl_sid", SID, 30); }

  // Captura UTMs da URL atual (e click IDs)
  function readCurrentTracking(){
    var params = new URLSearchParams(window.location.search);
    var out = {};
    var i;
    for (i = 0; i < UTM_KEYS.length; i++) {
      var v = params.get(UTM_KEYS[i]);
      if (v) out[UTM_KEYS[i]] = v;
    }
    for (i = 0; i < CLICK_KEYS.length; i++) {
      var c = params.get(CLICK_KEYS[i]);
      if (c) out[CLICK_KEYS[i]] = c;
    }
    return out;
  }

  function persistTracking(){
    var trackedKeys = UTM_KEYS.concat(CLICK_KEYS);
    var have = false;
    var currentSearch = window.location.search || "";
    // Se URL tem UTMs, capture e salve em cookie (renova a cada visita com UTMs)
    if (currentSearch.indexOf("utm_") !== -1 || currentSearch.indexOf("clid") !== -1) {
      var cur = readCurrentTracking();
      if (Object.keys(cur).length > 0) {
        setCookie("_fl_utm", JSON.stringify(cur), 30);
        have = true;
      }
    }
    // Se não tem UTMs na URL, tenta restaurar do cookie
    if (!have) {
      var stored = getCookie("_fl_utm");
      if (stored) {
        try { return JSON.parse(stored); } catch(e) {}
      }
    }
    return readCurrentTracking();
  }

  var trackingParams = persistTracking();
  var fbclid = trackingParams.fbclid || null;
  var ttclid = trackingParams.ttclid || null;
  var gclid = trackingParams.gclid || null;
  var fbp = getCookie("_fbp") || null;
  var fbc = getCookie("_fbc") || null;

  // Lockup do productId é opcional no snippet (produtor pode setar
  // <script>window.__fl_product_id = "UUID"</script> ANTES deste script)
  var productId = window.__fl_product_id || null;

  // Dispara evento server-side via fetch no-cors (bypass ad blockers)
  // Gera event_id único para dedup com pixel client-side (CAPI)
  // Armazena em window.__fl_last_event_id para que inject() possa injetar na URL
  // do redirect (/r/[token]), evitando PageView duplicado no CAPI.
  function sendTrack(eventName){
    try {
      var eventId = eventName + "_" + uuidv4();
      window.__fl_last_event_id = eventId;
      var payload = {
        t: TOKEN,
        event_name: eventName,
        event_id: eventId,
        product_id: productId,
        url: window.location.href,
        referrer: document.referrer || null,
        utm: trackingParams,
        fbclid: fbclid,
        ttclid: ttclid,
        gclid: gclid,
        fbp: fbp,
        fbc: fbc,
        session_id: SID
      };
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(payload)], { type: "application/json" }));
      } else {
        fetch(ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(function(){});
      }
    } catch(e){ /* swallow */ }
  }

  sendTrack("page_view");

  // Configuração de seletores CSS para capturar cliques (configurável pelo produtor)
  // Ex: window.__fl_checkout_selectors = ".btn-comprar, [data-checkout]"
  var CUSTOM_SELECTORS = window.__fl_checkout_selectors || null;

  // Intercepta clicks em links para o checkout da Flowyn (/checkout/...)
  // e injeta UTMs + session_id para preservar attribution cross-domain.
  // Suporta: <a href>, <button data-href>, e seletores customizados.
  function inject(e){
    try {
      var target = e.target;

      // 1. Tenta encontrar <a href> mais próximo
      var a = target.closest ? target.closest("a[href]") : null;

      // 2. Se não encontrou, tenta seletores customizados
      if (!a && CUSTOM_SELECTORS && target.closest) {
        a = target.closest(CUSTOM_SELECTORS);
      }

      // 3. Se não encontrou, tenta <button data-href>
      if (!a && target.closest) {
        a = target.closest("[data-href]");
      }

      if (!a) return;

      // Obtém o href (de <a href> ou <button data-href>)
      var href = a.getAttribute("href") || a.getAttribute("data-href");
      if (!href) return;

      // Verifica se é link para checkout
      var isCheckout = href.indexOf("flowyn.com/checkout/") !== -1 ||
                       href.indexOf("/checkout/") !== -1 ||
                       href.indexOf("/r/") !== -1;
      if (!isCheckout) return;

      // Para links /r/ (redirect server-side), injeta UTMs como query params
      // (o cookie _fl_utm está no domínio da landing, não do flowyn.com,
      //  então o servidor não consegue ler — precisamos passar via URL)
      if (href.indexOf("/r/") !== -1) {
        try {
          var rUrl = new URL(href, window.location.origin);
          var prop;
          for (prop in trackingParams) {
            if (!trackingParams.hasOwnProperty(prop)) continue;
            if (!rUrl.searchParams.has(prop)) {
              rUrl.searchParams.set(prop, trackingParams[prop]);
            }
          }
          // Injeta _fbp/_fbc cross-domain (cookies ficam no domínio da landing)
          if (fbp && !rUrl.searchParams.has("_fbp")) rUrl.searchParams.set("_fbp", fbp);
          if (fbc && !rUrl.searchParams.has("_fbc")) rUrl.searchParams.set("_fbc", fbc);
          if (!rUrl.searchParams.has("fl_sid")) rUrl.searchParams.set("fl_sid", SID);
          // Injeta event_id do beacon para dedup CAPI com /r/[token]
          if (window.__fl_last_event_id && !rUrl.searchParams.has("_fl_eid")) {
            rUrl.searchParams.set("_fl_eid", window.__fl_last_event_id);
          }
          a.setAttribute("href", rUrl.toString());
        } catch(_) {}
        return;
      }

      var url;
      try { url = new URL(href, window.location.origin); }
      catch(_) { return; }

      // Injeta UTMs se ainda não presentes
      var prop;
      for (prop in trackingParams) {
        if (!trackingParams.hasOwnProperty(prop)) continue;
        if (!url.searchParams.has(prop)) {
          url.searchParams.set(prop, trackingParams[prop]);
        }
      }
      if (!url.searchParams.has("fl_sid")) url.searchParams.set("fl_sid", SID);

      a.setAttribute("href", url.toString());
    } catch(_) { /* swallow */ }
  }

  document.addEventListener("click", inject, true);

  // Expõe helper para o produtor chamar manualmente se quiser (raramente necessário)
  window.__fl_track = function(name){
    if (name === "view_content") sendTrack("view_content");
  };
})();`
}
