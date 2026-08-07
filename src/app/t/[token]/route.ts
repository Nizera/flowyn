import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getAppUrl } from '@/lib/app-url'
import { decryptApiKey } from '@/lib/encryption'

// Serve o tracker.js customizado para cada pixel (lookup pelo public_token).
// URL publica: https://flowyn.com/t/PUBLIC_TOKEN.js
// Produtor cola no HTML da landing externa: <script src="https://flowyn.com/t/UUID.js" async></script>
//
// O script (v2):
// 1) Injeta pixel Meta com pixel_id do produtor (se não existe)
// 2) Fire PageView, ViewContent com event_ids para dedup pixel+CAPI
// 3) Intercepta clicks em CTAs e fire InitiateCheckout com event_id
// 4) Gera session_id (uuid v4) e salva em first-party cookie (_fl_sid), 30 dias
// 5) Captura UTMs da URL atual (+ fbclid/ttclid/gclid)
// 6) Injeta UTMs nos links de checkout
//
// PIXEL_ID é decodificado server-side e passado para o browser.
// Pixel IDs são semi-públicos (sempre aparecem no client via fbevents.js).

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

  // Decodifica pixel_id para injeção no browser (pixel IDs são semi-públicos)
  const decryptedPixelId = decryptApiKey(pixel.pixel_id)
  if (!decryptedPixelId) {
    return new NextResponse('pixel not configured', { status: 500 })
  }

  const appUrl = getAppUrl()
  const js = buildTrackerJs(token, appUrl, decryptedPixelId)

  return new NextResponse(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=60, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function buildTrackerJs(publicToken: string, appUrl: string, pixelId: string): string {
  return `/* FlowynPay cross-domain tracker v2 — public_token=${publicToken} */
(function(){
  "use strict";
  if (window.__fl_tracker) return;
  window.__fl_tracker = true;

  var TOKEN = ${JSON.stringify(publicToken)};
  var ENDPOINT = ${JSON.stringify(appUrl)} + "/api/tr/track";
  var APP_ORIGIN = ${JSON.stringify(appUrl)};
  var PIXEL_ID = ${JSON.stringify(pixelId)};

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

  // External ID — ID anônimo persistente, 1 ano (melhora matching CAPI em ~15%)
  var UID = getCookie("_fl_uid");
  if (!UID) { UID = uuidv4(); setCookie("_fl_uid", UID, 365); }

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
    if (currentSearch.indexOf("utm_") !== -1 || currentSearch.indexOf("clid") !== -1) {
      var cur = readCurrentTracking();
      if (Object.keys(cur).length > 0) {
        setCookie("_fl_utm", JSON.stringify(cur), 30);
        have = true;
      }
    }
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

  var productId = window.__fl_product_id || null;

  // Dispara evento server-side via beacon (bypass ad blockers)
  function sendTrackWithId(eventName, eventId){
    try {
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
        session_id: SID,
        external_id: UID
      };
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(payload)], { type: "application/json" }));
      } else {
        fetch(ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(function(){});
      }
    } catch(e){ /* swallow */ }
  }

  // === INJEÇÃO DO PIXEL META ===
  // Padrão EXATO do Meta: IIFE que cria fbq + insere script antes do primeiro <script>
  if (!window.fbq) {
    // CAPI eventos imediatamente
    var pvEid = 'pv_' + uuidv4();
    sendTrackWithId('page_view', pvEid);
    var vcEid = 'vc_' + uuidv4();
    sendTrackWithId('view_content', vcEid);

    // Pixel injection — padrão oficial Meta
    var s = document.getElementsByTagName('script')[0];
    var t = document.createElement('script');
    t.async = true;
    t.src = 'https://connect.facebook.net/en_US/fbevents.js';
    s.parentNode.insertBefore(t, s);

    // Cria stub fbq (depois do script existir, mas antes do fbevents.js carregar)
    window.fbq = function() {
      (fbq.q = fbq.q || []).push(arguments);
    };
    window.fbq.q = [];

    // Enfileira pixel events
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView', {}, { eventID: pvEid });
    fbq('track', 'ViewContent', {}, { eventID: vcEid });
  } else {
    console.warn('[Flowyn] Pixel Meta detectado na página.');
  }

  // === CLICK INJECTION + INITIATECHECKOUT ===
  var icFired = false;
  var CUSTOM_SELECTORS = window.__fl_checkout_selectors || null;

  function inject(e){
    try {
      var target = e.target;
      var a = target.closest ? target.closest("a[href]") : null;
      if (!a && CUSTOM_SELECTORS && target.closest) {
        a = target.closest(CUSTOM_SELECTORS);
      }
      if (!a && target.closest) {
        a = target.closest("[data-href]");
      }
      if (!a) return;

      var href = a.getAttribute("href") || a.getAttribute("data-href");
      if (!href) return;

      var isCheckout = href.indexOf("flowyn.com/checkout/") !== -1 ||
                       href.indexOf("/checkout/") !== -1 ||
                       href.indexOf("/r/") !== -1;
      if (!isCheckout) return;

      // Fire InitiateCheckout no clique do CTA (pixel + CAPI com mesmo event_id)
      if (window.fbq && !icFired) {
        icFired = true;
        var icEid = 'ic_' + uuidv4();
        try {
          fbq('track', 'InitiateCheckout', {}, { eventID: icEid });
        } catch(_) {}
        sendTrackWithId('initiate_checkout', icEid);
      }

      // Injeta UTMs no link (código existente)
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
          if (fbp && !rUrl.searchParams.has("_fbp")) rUrl.searchParams.set("_fbp", fbp);
          if (fbc && !rUrl.searchParams.has("_fbc")) rUrl.searchParams.set("_fbc", fbc);
          if (!rUrl.searchParams.has("fl_sid")) rUrl.searchParams.set("fl_sid", SID);
          if (UID && !rUrl.searchParams.has("_fl_uid")) rUrl.searchParams.set("_fl_uid", UID);
          a.setAttribute("href", rUrl.toString());
        } catch(_) {}
        return;
      }

      var url;
      try { url = new URL(href, window.location.origin); }
      catch(_) { return; }

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

  // Helper para produtor chamar manualmente (raramente necessário)
  window.__fl_track = function(name){
    if (name === "view_content") {
      var eid = 'vc_' + uuidv4();
      if (window.fbq) {
        try { fbq('track', 'ViewContent', {}, { eventID: eid }); } catch(_) {}
      }
      sendTrackWithId('view_content', eid);
    }
  };
})();`
}
