/* A&K Climate Control — site behaviour
   ==================================================================
   FORM DELIVERY
   Service requests POST to Web3Forms and land in the inbox the access
   key is bound to. The key is PUBLIC by design (it ships in the page
   source); it only allows sending to that one address. Until a key is
   pasted below, forms fall back to opening the visitor's email app so
   nothing is silently lost.
   ================================================================== */
const FORM_ACCESS_KEY = '';            // TODO: web3forms.com key bound to the client's inbox
const FORM_ENDPOINT = 'https://api.web3forms.com/submit';

/* Tracking: every call is inert while these are empty. */
const GOOGLE_ADS_ID = '';              // e.g. 'AW-1234567890'
const ADS_CONVERSIONS = { request: '', phone: '' };   // 'AW-.../label'
const ADS_VALUES = { request: 150, phone: 150 };
const META_PIXEL_ID = '1820622422583487';   // Events Manager dataset "AK Climate Control Website", created 2026-09-24

const PHONE = document.body.dataset.phone || '';
const BUSINESS_EMAIL = document.body.dataset.email || '';

(function loadGoogleTag() {
  if (!GOOGLE_ADS_ID || window.gtag) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_ADS_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GOOGLE_ADS_ID);
})();

function trackConversion(kind) {
  const id = ADS_CONVERSIONS[kind];
  if (!id || typeof window.gtag !== 'function') return;
  window.gtag('event', 'conversion', { send_to: id, value: ADS_VALUES[kind] || 0, currency: 'USD' });
}

(function loadMetaPixel() {
  if (!META_PIXEL_ID || window.fbq) return;
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
    n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', META_PIXEL_ID);
  window.fbq('track', 'PageView');
})();

function trackMeta(event, params) {
  if (!META_PIXEL_ID || typeof window.fbq !== 'function') return;
  window.fbq('track', event, params || {});
}

/* Phone taps are the biggest conversion on mobile and invisible to the ad
   platforms without this. */
document.addEventListener('click', function (e) {
  const tel = e.target.closest && e.target.closest('a[href^="tel:"]');
  if (!tel) return;
  trackMeta('Contact', { content_name: 'phone_click' });
  trackConversion('phone');
});

const FORM_READY = Boolean(FORM_ENDPOINT && FORM_ACCESS_KEY);

/* ---------- Mobile navigation ---------- */
(function () {
  const openBtn = document.querySelector('[data-nav-open]');
  const closeBtn = document.querySelector('[data-nav-close]');
  const panel = document.querySelector('.mobile-nav');
  if (!openBtn || !panel) return;
  const open = () => { panel.classList.add('is-open'); document.body.classList.add('nav-open'); openBtn.setAttribute('aria-expanded', 'true'); };
  const close = () => { panel.classList.remove('is-open'); document.body.classList.remove('nav-open'); openBtn.setAttribute('aria-expanded', 'false'); };
  openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  panel.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();

/* ---------- Service request forms ---------- */
(function () {
  document.querySelectorAll('form[data-request-form]').forEach(form => {
    const msg = form.querySelector('.form-msg');
    const btn = form.querySelector('button[type="submit"]');
    const say = (text, kind) => { if (!msg) return; msg.textContent = text; msg.className = 'form-msg is-' + kind; };

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());

      if (!data.name || !data.phone) {
        say('Please add your name and a phone number so we can reach you.', 'err');
        return;
      }
      if (data.phone.replace(/\D/g, '').length < 10) {
        say('That phone number looks short. Please enter all 10 digits.', 'err');
        form.querySelector('[name=phone]').focus();
        return;
      }
      if (data.company) return;   // honeypot

      const urgent = data.urgency === 'Emergency';
      const subject = (urgent ? 'EMERGENCY: ' : 'Service request: ') + (data.service || 'HVAC') + ' / ' + data.name;
      const lines = [
        'Name: ' + data.name,
        'Phone: ' + data.phone,
        'Email: ' + (data.email || 'not given'),
        'Address / ZIP: ' + (data.address || 'not given'),
        'Service: ' + (data.service || 'not given'),
        'How soon: ' + (data.urgency || 'not given'),
        'Page: ' + location.pathname,
        '',
        'Details:',
        data.details || 'none'
      ].join('\n');

      if (FORM_READY) {
        const original = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
        try {
          const payload = new FormData(form);
          payload.delete('company');
          payload.append('access_key', FORM_ACCESS_KEY);
          payload.append('subject', subject);
          payload.append('page', location.pathname);
          if (data.email) payload.append('replyto', data.email);
          const res = await fetch(FORM_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: payload });
          if (!res.ok) throw new Error('request failed, code ' + res.status);
          // Only after the server confirms. A click is not a lead.
          trackConversion('request');
          trackMeta('Lead', { content_name: data.service || 'service_request' });
          form.reset();
          say(urgent
            ? 'Request received. For an emergency, please also call ' + PHONE + ' now so we can get a technician moving right away.'
            : 'Request received, thank you. We will call you back shortly to confirm a time. Need us sooner? Call ' + PHONE + '.', 'ok');
        } catch (err) {
          say('That did not go through (' + err.message + '). Please call ' + PHONE + ' and we will take care of it.', 'err');
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = original; }
        }
        return;
      }

      // No key configured yet: hand off to the visitor's email app.
      window.location.href = 'mailto:' + BUSINESS_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines);
      say('Opening your email app with the details filled in. Just press send. If nothing opened, call ' + PHONE + ' and we will take care of it.', 'ok');
    });
  });
})();

/* Preselect the service dropdown from ?service= so page CTAs carry context */
(function () {
  const want = new URLSearchParams(location.search).get('service');
  if (!want) return;
  document.querySelectorAll('select[name=service]').forEach(sel => {
    [...sel.options].forEach(o => { if (o.value.toLowerCase() === want.toLowerCase()) sel.value = o.value; });
  });
})();

/* ---------- Service-area map ---------- */
(function () {
  document.querySelectorAll('[data-map]').forEach(wrap => {
    const pins = [...wrap.querySelectorAll('.map-pin')];
    const buttons = [...wrap.querySelectorAll('.area-list button')];
    const caption = wrap.querySelector('[data-map-caption]');
    if (!pins.length || !buttons.length) return;
    const DEFAULT = caption ? caption.innerHTML : '';
    let current = null;
    const select = slug => {
      current = slug === current ? null : slug;
      pins.forEach(p => p.classList.toggle('is-active', p.dataset.city === current));
      buttons.forEach(b => b.classList.toggle('is-active', b.dataset.city === current));
      if (!caption) return;
      if (!current) { caption.innerHTML = DEFAULT; return; }
      const name = buttons.find(b => b.dataset.city === current).textContent.trim();
      caption.textContent = '';
      const b = document.createElement('b'); b.textContent = name;
      caption.append('Yes, we cover ', b, '. Heating, cooling and water heater service, repair and installation. Call ' + PHONE + ' or request service online.');
    };
    buttons.forEach(b => b.addEventListener('click', () => select(b.dataset.city)));
    pins.forEach(p => {
      p.addEventListener('click', () => select(p.dataset.city));
      p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(p.dataset.city); } });
    });
  });
})();

/* ---------- Header shadow, reveal, year ---------- */
(function () {
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  const els = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && els.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
  } else {
    els.forEach(el => el.classList.add('in'));
  }
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
