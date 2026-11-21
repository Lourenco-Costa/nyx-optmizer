'use strict';

/**
 * Utilitarios de interface: icones, formatacao, toasts, modais e animacoes.
 */

(function () {
  const OTZ = (window.OTZ = window.OTZ || {});

  const ICONS = {
    dashboard:
      '<rect x="3.2" y="3.2" width="7.4" height="7.4" rx="2.2"/><rect x="13.4" y="3.2" width="7.4" height="7.4" rx="2.2"/><rect x="3.2" y="13.4" width="7.4" height="7.4" rx="2.2"/><rect x="13.4" y="13.4" width="7.4" height="7.4" rx="2.2"/>',
    sliders:
      '<path d="M4 7h9M17.5 7H20M4 17h3M11.5 17H20"/><circle cx="15" cy="7" r="2.4"/><circle cx="8" cy="17" r="2.4"/>',
    broom:
      '<path d="M14.5 3.6l5.9 5.9-8.3 8.3H5.4v-6.7z"/><path d="M10.8 7.3l5.9 5.9M5.4 17.8l-1.6 2.6"/><path d="M16.8 14.6l2.5 2.5"/>',
    shield: '<path d="M12 3l7.4 3v6.1c0 4.4-3 8-7.4 9.4-4.4-1.4-7.4-5-7.4-9.4V6z"/><path d="M8.8 11.9l2.2 2.2 4.4-4.5"/>',
    gear:
      '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6L6 18M18 6l1.6-1.6"/>',
    bolt: '<path d="M13.6 2.6 5.9 13.3h5.1l-1.3 8.1 8.4-11.2h-5.2z"/>',
    flask: '<path d="M9 3h6M10 3v5.3L4.9 18a2 2 0 0 0 1.7 3h10.8a2 2 0 0 0 1.7-3L14 8.3V3"/><path d="M7.5 14.5h9"/>',
    check: '<path d="M4.6 12.6l4.6 4.6L19.4 6.8"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    alert: '<path d="M12 3.6l8.8 15.2H3.2z"/><path d="M12 9.4v4.4M12 16.6v.01"/>',
    info: '<circle cx="12" cy="12" r="8.8"/><path d="M12 11.2v5.2M12 7.8v.01"/>',
    lock: '<rect x="4.6" y="10" width="14.8" height="10.4" rx="2.6"/><path d="M8.2 10V7.5a3.8 3.8 0 017.6 0V10"/><path d="M12 14v2.4"/>',
    refresh: '<path d="M20 11.2A8 8 0 105.8 16"/><path d="M20 5.2v6h-6"/>',
    trash: '<path d="M4.2 7h15.6M9.4 7V4.9h5.2V7"/><path d="M6.6 7l.8 12.1a2 2 0 002 1.9h5.2a2 2 0 002-1.9L17.4 7"/>',
    cpu: '<rect x="7" y="7" width="10" height="10" rx="2.4"/><path d="M10 3.2v3.4M14 3.2v3.4M10 17.4v3.4M14 17.4v3.4M3.2 10h3.4M3.2 14h3.4M17.4 10h3.4M17.4 14h3.4"/>',
    memory:
      '<rect x="3" y="7" width="18" height="9.4" rx="2"/><path d="M7 16.4v2.8M12 16.4v2.8M17 16.4v2.8M7.4 10.6v2.4M12 10.6v2.4M16.6 10.6v2.4"/>',
    disk: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="2.2"/><path d="M18.4 7.4l-5 3.2"/>',
    clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4v4.8l3.1 1.9"/>',
    search: '<circle cx="10.9" cy="10.9" r="6.4"/><path d="M15.6 15.6L20 20"/>',
    key: '<circle cx="8.4" cy="12" r="4.2"/><path d="M12.6 12h8.2M17.4 12v3.4M20.2 12v2.6"/>',
    play: '<path d="M8.4 5.6l9.8 6.4-9.8 6.4z"/>',
    power: '<path d="M12 3.4v7.4"/><path d="M7.4 6.4a7.6 7.6 0 109.2 0"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevronRight: '<path d="M9.6 5.8l6.2 6.2-6.2 6.2"/>',
    star: '<path d="M12 3.6l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9z"/>',
    windows: '<path d="M4 5.6l7.1-1v7H4zM13 4.2l7-1v8.4h-7zM4 12.6h7.1v7L4 18.4zM13 12.6h7v9.2l-7-1z"/>',
    mouse: '<rect x="6.4" y="2.8" width="11.2" height="18.4" rx="5.6"/><path d="M12 6.6v4.2"/>',
    wifi: '<path d="M4 9.4a12 12 0 0116 0M7 12.8a8 8 0 0110 0M10 16.2a4 4 0 014 0"/><path d="M12 19.6v.01"/>',
    flame: '<path d="M12 21c3.6 0 6.2-2.4 6.2-5.6 0-4.2-4.6-6.2-4.6-11.4-2.4 1.4-4 4-4 6.2 0 1.2.4 2.2 1 3-1.6.2-2.8 1.6-2.8 3.2 0 2.6 2.2 4.6 4.2 4.6z"/>',
    sparkles: '<path d="M9.8 3.4l1.5 4.3 4.3 1.5-4.3 1.5-1.5 4.3-1.5-4.3L4 9.2l4.3-1.5z"/><path d="M17.6 14.2l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z"/>',
    folder: '<path d="M3.4 7.4a2 2 0 012-2h3.4l2 2.4h7.8a2 2 0 012 2v8.2a2 2 0 01-2 2H5.4a2 2 0 01-2-2z"/>',
    link: '<path d="M10.4 13.6a4.6 4.6 0 006.5 0l2.4-2.4a4.6 4.6 0 00-6.5-6.5l-1.6 1.6"/><path d="M13.6 10.4a4.6 4.6 0 00-6.5 0l-2.4 2.4a4.6 4.6 0 006.5 6.5l1.6-1.6"/>',
    globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.6 12h16.8M12 3.4c2.6 2.4 3.9 5.4 3.9 8.6s-1.3 6.2-3.9 8.6c-2.6-2.4-3.9-5.4-3.9-8.6S9.4 5.8 12 3.4z"/>',
    crown: '<path d="M4 8.4l3.4 2.6L12 5l4.6 6 3.4-2.6-1.5 9.2H5.5z"/><path d="M6 20h12"/>',
    activity: '<path d="M3 12h4l2.2-6 4.2 12 2.4-6H21"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    timer: '<circle cx="12" cy="13" r="7.4"/><path d="M12 9.4V13l2.6 1.6M9.4 3h5.2M12 3v2.6"/>',
    router: '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M6.4 16.4h.01M9.4 16.4h.01M7 9.6a6.4 6.4 0 0110 0M9.4 6.6a10 10 0 015.2 0"/>',
    arrowUpRight: '<path d="M7 17L17 7M9 7h8v8"/>',
    minus: '<path d="M5 12h14"/>',
    monitor: '<rect x="3" y="4.4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16.4V20"/>',
    layers: '<path d="M12 3.4l8.4 4.2L12 11.8 3.6 7.6z"/><path d="M3.6 12l8.4 4.2 8.4-4.2M3.6 16.4l8.4 4.2 8.4-4.2"/>',
    gauge: '<path d="M4 15.4a8.4 8.4 0 1116 0"/><path d="M12 15.4l3.4-3.8"/><circle cx="12" cy="15.6" r="1.4"/>',
  };

  function icon(name, cls = 'ico') {
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  }

  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
  }

  function fmtNumber(value, decimals = 0) {
    const locale = OTZ.i18n && OTZ.i18n.lang === 'en' ? 'en-US' : 'pt-PT';
    return Number(value || 0).toLocaleString(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function fmtBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
    const scaled = value / 1024 ** index;
    const decimals = index === 0 ? 0 : scaled >= 100 ? 0 : 1;
    return `${fmtNumber(scaled, decimals)} ${units[index]}`;
  }

  function fmtUptime(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    const days = Math.floor(value / 86400);
    const hours = Math.floor((value % 86400) / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function truncate(text, length) {
    const value = String(text || '');
    return value.length > length ? `${value.slice(0, length - 1)}…` : value;
  }

  function animateNumber(element, target, options = {}) {
    if (!element) return;
    const { duration = 900, decimals = 0, prefix = '', suffix = '' } = options;
    const from = Number(element.dataset.value || 0);
    const to = Number(target) || 0;
    if (from === to) {
      element.textContent = `${prefix}${fmtNumber(to, decimals)}${suffix}`;
      return;
    }
    element.dataset.value = String(to);
    const started = performance.now();
    const format = (value) => `${prefix}${fmtNumber(value, decimals)}${suffix}`;

    function frame(now) {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      element.textContent = format(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // O requestAnimationFrame e suspenso com a janela em segundo plano:
    // garante que o valor final e sempre pintado.
    clearTimeout(element._numberFallback);
    element._numberFallback = setTimeout(() => {
      element.textContent = format(to);
    }, duration + 220);
  }

  /* ------------------------------------------------------------------ */
  /* Toasts                                                             */
  /* ------------------------------------------------------------------ */

  const TOAST_ICONS = { info: 'info', success: 'check', error: 'alert', warn: 'alert' };

  function toast({ title, text = '', type = 'info', timeout = 4600 }) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const element = document.createElement('div');
    element.className = `toast ${type}`;
    element.innerHTML = `
      <span class="toast-icon">${icon(TOAST_ICONS[type] || 'info')}</span>
      <div class="toast-body">
        <div class="toast-title">${esc(title)}</div>
        ${text ? `<div class="toast-text">${esc(text)}</div>` : ''}
      </div>`;
    host.appendChild(element);
    const remove = () => {
      element.classList.add('out');
      setTimeout(() => element.remove(), 300);
    };
    setTimeout(remove, timeout);
  }

  /* ------------------------------------------------------------------ */
  /* Modal                                                              */
  /* ------------------------------------------------------------------ */

  function modal(options = {}) {
    const {
      title = '',
      text = '',
      html = '',
      confirmText = 'Confirmar',
      cancelText = 'Cancelar',
      tone = 'primary',
      iconName = 'info',
      showCancel = true,
    } = options;

    return new Promise((resolve) => {
      const root = document.getElementById('modal-root');
      if (!root) return resolve(false);

      root.innerHTML = `
        <div class="modal-backdrop" data-modal-cancel></div>
        <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="modal-icon">${icon(iconName)}</div>
          <h3>${esc(title)}</h3>
          ${text ? `<p>${esc(text)}</p>` : ''}
          ${html ? `<div class="modal-extra">${html}</div>` : ''}
          <div class="modal-actions">
            ${showCancel ? `<button class="btn btn-ghost" type="button" data-modal-cancel>${esc(cancelText)}</button>` : ''}
            <button class="btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}" type="button" data-modal-confirm>${esc(confirmText)}</button>
          </div>
        </div>`;
      root.classList.add('open');

      let settled = false;
      const close = (value) => {
        if (settled) return;
        settled = true;
        root.classList.remove('open');
        root.innerHTML = '';
        resolve(value);
      };

      root.querySelectorAll('[data-modal-cancel]').forEach((node) => node.addEventListener('click', () => close(false)));
      root.querySelector('[data-modal-confirm]')?.addEventListener('click', () => close(true));
      setTimeout(() => root.querySelector('[data-modal-confirm]')?.focus(), 40);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Holofote                                                           */
  /* ------------------------------------------------------------------ */

  document.addEventListener(
    'pointermove',
    (event) => {
      const surface = event.target.closest && event.target.closest('.spot');
      if (!surface) return;
      const rect = surface.getBoundingClientRect();
      surface.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      surface.style.setProperty('--my', `${event.clientY - rect.top}px`);
    },
    { passive: true }
  );

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const root = document.getElementById('modal-root');
    if (root && root.classList.contains('open')) {
      root.querySelector('[data-modal-cancel]')?.click();
    }
  });

  OTZ.ui = {
    icon,
    ICONS,
    esc,
    fmtBytes,
    fmtNumber,
    fmtUptime,
    clamp,
    truncate,
    animateNumber,
    toast,
    modal,
  };
})();
