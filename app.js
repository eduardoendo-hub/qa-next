/* ──────────────────────────────────────────────────────────────────────────────
 *  app.js — QA Next (qanext.impacta.com.br)
 *  ─────────────────────────────────────────────────────────────────────────────
 *  O que faz:
 *   1. Captura utm_* da URL (e os persiste por sessão).
 *   2. Repassa os UTMs para TODOS os links de saída (checkout Engaged + WhatsApp),
 *      preservando os params que o anúncio mandou pra esta página.
 *   3. Pixel Meta — placeholder no-op até META_PIXEL_ID ser preenchido.
 *
 *  Sem barreira de captura de dados: WhatsApp e checkout vão direto.
 *  ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var CFG = {
    // Preencher quando o Pixel entrar (deixe vazio = no-op):
    META_PIXEL_ID: '',
    // Campanha/turma vigente — usada em eventos e atribuição IRIS:
    CAMPAIGN_SLUG: 'qa-next-agosto-2026',
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

  // ─── 3. Aplica nos links de saída (checkout + whatsapp) ───────────────────
  function decorateOutboundLinks(params) {
    document.querySelectorAll('a[data-cta]').forEach(function (el) {
      if (el.dataset.utmApplied) return;
      var href = el.getAttribute('href') || '';
      // só decora URLs absolutas (checkout/WhatsApp), nunca âncoras internas
      if (href.indexOf('http') !== 0) return;
      el.setAttribute('href', withTracking(href, params));
      el.dataset.utmApplied = '1';
      el.addEventListener('click', function () {
        track(el.getAttribute('data-cta') === 'checkout' ? 'InitiateCheckout' : 'Contact',
              { placement: el.getAttribute('data-cta') });
      });
    });
  }

  // ─── 4. Pixel Meta (no-op até ter ID) ─────────────────────────────────────
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

  // ─── 5. Run + observa mudanças no DOM ─────────────────────────────────────
  function apply() {
    var params = getTrackingParams();
    decorateOutboundLinks(params);
  }

  initPixel();
  apply();
  new MutationObserver(apply).observe(document.body, { childList: true, subtree: true });
})();
