/* ──────────────────────────────────────────────────────────────────────────────
 *  app.js — QA Next (qanext.impacta.com.br)
 *  ─────────────────────────────────────────────────────────────────────────────
 *  O que faz:
 *   1. Captura utm_* da URL (e os persiste por sessão).
 *   2. Repassa os UTMs para TODOS os links de saída (checkout Engaged + WhatsApp),
 *      preservando os params que o anúncio mandou pra esta página.
 *   3. Empurra eventos pra IRIS (cockpit em tempo real): lp_view, click_compra,
 *      click_whats — POST /api/events (mesma convenção das LPs irmãs).
 *   4. Pixel Meta — placeholder no-op até META_PIXEL_ID ser preenchido.
 *
 *  Sem barreira de captura de dados: WhatsApp e checkout vão direto.
 *  (Sem integração com integracao-rd por enquanto — não há form de lead.)
 *  ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var CFG = {
    PRODUCT_SLUG:    'qa-next',
    CAMPAIGN_SLUG:   'qa-next-agosto-2026',
    IRIS_EVENTS_URL: 'https://iris.technowhub.ai/api/events',
    TICKET_VALUE:    697,            // lote vigente (pioneiro) — referência p/ value
    CURRENCY:        'BRL',
    // Pixel da Meta (QA Next - Impacta) — dispara PageView + InitiateCheckout + Contact:
    META_PIXEL_ID:   '1540836994378279',
  };

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  // Outros params de clique que também devem ser repassados ao checkout:
  var PASSTHROUGH_KEYS = ['gclid', 'fbclid', 'gad_source', 'msclkid'];
  var ALL_KEYS = UTM_KEYS.concat(PASSTHROUGH_KEYS);

  // ─── 1. Captura + persiste params da URL ──────────────────────────────────
  function getTrackingParams() {
    var qs = new URLSearchParams(window.location.search);
    var saved = {};
    try { saved = JSON.parse(sessionStorage.getItem('qn_tracking') || '{}'); } catch (e) {}
    ALL_KEYS.forEach(function (k) {
      var v = qs.get(k);
      if (v) saved[k] = v;
    });
    try { sessionStorage.setItem('qn_tracking', JSON.stringify(saved)); } catch (e) {}
    return saved;
  }

  // ─── 2. Anexa os params capturados a uma URL absoluta, sem sobrescrever ────
  function withTracking(rawHref, params) {
    if (!rawHref) return rawHref;
    var url;
    try { url = new URL(rawHref, window.location.href); } catch (e) { return rawHref; }
    Object.keys(params).forEach(function (k) {
      if (!url.searchParams.has(k)) url.searchParams.set(k, params[k]);
    });
    return url.toString();
  }

  // ─── 3. Evento pra IRIS (cockpit em tempo real) ───────────────────────────
  function sendIrisEvent(eventName, extra) {
    try {
      var p = getTrackingParams();
      var body = {
        product_slug:  CFG.PRODUCT_SLUG,
        event_name:    eventName,
        campaign_slug: CFG.CAMPAIGN_SLUG,
        page_url:      location.href,
        utm_source:    p.utm_source   || null,
        utm_medium:    p.utm_medium   || null,
        utm_campaign:  p.utm_campaign || null,
        utm_content:   p.utm_content  || null,
        utm_term:      p.utm_term     || null,
        referrer:      document.referrer || null
      };
      if (extra && extra.value != null) body.value = extra.value;
      if (extra && extra.currency)      body.currency = extra.currency;
      if (extra)                        body.meta = extra;
      fetch(CFG.IRIS_EVENTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        mode: 'cors'
      }).catch(function () {});
    } catch (e) {}
  }

  // ─── 4. Aplica nos links de saída (checkout + whatsapp) ───────────────────
  function decorateOutboundLinks(params) {
    document.querySelectorAll('a[data-cta]').forEach(function (el) {
      if (el.dataset.utmApplied) return;
      var href = el.getAttribute('href') || '';
      // só decora URLs absolutas (checkout/WhatsApp), nunca âncoras internas
      if (href.indexOf('http') !== 0) return;
      el.setAttribute('href', withTracking(href, params));
      el.dataset.utmApplied = '1';
      var cta = el.getAttribute('data-cta');
      el.addEventListener('click', function () {
        if (cta === 'checkout') {
          sendIrisEvent('click_compra', { value: CFG.TICKET_VALUE, currency: CFG.CURRENCY });
          track('InitiateCheckout', { value: CFG.TICKET_VALUE, currency: CFG.CURRENCY, placement: cta });
        } else if (cta === 'whatsapp') {
          sendIrisEvent('click_whats', { channel: 'whatsapp' });
          track('Contact', { placement: cta });
        }
      });
    });
  }

  // ─── 5. Pixel Meta (no-op até ter ID) ─────────────────────────────────────
  function initPixel() {
    if (!CFG.META_PIXEL_ID || window.fbq) return;
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', CFG.META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  function track(eventName, params) {
    params = params || {};
    if (window.fbq) { try { window.fbq('track', eventName, params); } catch (e) {} }
    if (window.dataLayer) { window.dataLayer.push(Object.assign({ event: eventName }, params)); }
  }

  // ─── 6. Run + observa mudanças no DOM ─────────────────────────────────────
  function apply() {
    var params = getTrackingParams();
    decorateOutboundLinks(params);
  }

  initPixel();
  apply();
  new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });

  // lp_view — uma vez por carregamento
  sendIrisEvent('lp_view');
})();

/* ──────────────────────────────────────────────────────────────────────────────
 *  Bloco Impacta (portado da LP MySQL): vídeo Av. Paulista + contador "em números"
 *  ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  // Vídeo Paulista — toca ao entrar na tela + máscara final com logo Impacta
  var pv = document.getElementById('paulistaVideo');
  if (pv) {
    var ec = document.querySelector('.auth-endcard');
    var started = false;
    var vObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !started) { started = true; var p = pv.play(); if (p && p.catch) p.catch(function () {}); }
      });
    }, { threshold: .25 });
    vObs.observe(pv);
    pv.addEventListener('timeupdate', function () {
      var d = pv.duration || 0;
      if (ec) { if (d && pv.currentTime >= d - 3.4) ec.classList.add('show'); else ec.classList.remove('show'); }
    });
  }
  // Contador "Impacta em números"
  var bstats = document.querySelectorAll('.bigstat');
  if (bstats.length) {
    var fmt = function (val, dec) { var s = dec ? val.toFixed(dec) : Math.round(val).toString(); return s.replace('.', ','); };
    var run = function (el) {
      var t = parseFloat(el.dataset.target || '0'), dec = parseInt(el.dataset.decimals || '0', 10);
      var num = el.querySelector('.num'); var dur = 1400; var t0 = performance.now();
      var tick = function (now) {
        var p = Math.min(1, (now - t0) / dur); var e = 1 - Math.pow(1 - p, 3);
        num.textContent = fmt(t * e, dec);
        if (p < 1) requestAnimationFrame(tick); else num.textContent = fmt(t, dec);
      };
      requestAnimationFrame(tick);
    };
    var nObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { run(e.target); nObs.unobserve(e.target); } });
    }, { threshold: .4 });
    bstats.forEach(function (el) { nObs.observe(el); });
  }
})();

/* ──────────────────────────────────────────────────────────────────────────────
 *  Sticky CTA (porte da LP MySQL): aparece ao rolar para fora do hero.
 *  Esconde o WhatsApp flutuante enquanto a barra está visível.
 *  ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  var sticky = document.getElementById('stickyCta');
  var hero = document.getElementById('top');
  var fab = document.querySelector('.fab');
  if (!sticky || !hero) return;
  var sObs = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var show = !e.isIntersecting;
      sticky.classList.toggle('show', show);
      if (fab) { fab.style.opacity = show ? '0' : ''; fab.style.pointerEvents = show ? 'none' : ''; }
    });
  }, { threshold: 0 });
  sObs.observe(hero);
})();
