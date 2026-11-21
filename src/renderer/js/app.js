'use strict';

/**
 * Arranque do Nyx Optmizer: navegacao, cabecalho, licenca e ciclo de vida.
 */

(function () {
  const OTZ = window.OTZ;
  const { icon, toast, esc } = OTZ.ui;
  const api = OTZ.api;

  OTZ.pages = OTZ.pages || {};

  const NAV = [
    { id: 'dashboard', label: 'Smart', icon: 'sparkles' },
    { id: 'tweaks', label: 'Performance', icon: 'sliders' },
    { id: 'network', label: 'Network', icon: 'globe' },
    { id: 'cleaner', label: 'Cleanup', icon: 'broom' },
  ];

  const state = { info: null, license: null, page: null, activity: [] };

  const el = {
    tabs: document.getElementById('tabs'),
    rail: document.getElementById('rail-nav'),
    view: document.getElementById('view'),
    adminPill: document.getElementById('admin-pill'),
    proPill: document.getElementById('pro-pill'),
    previewPill: document.getElementById('preview-pill'),
    statusText: document.getElementById('status-text'),
    statusDot: document.getElementById('status-dot'),
    statusMeta: document.getElementById('status-meta'),
  };

  let cleanup = null;

  /* ------------------------------------------------------------------ */
  /* Utilitarios expostos as paginas                                    */
  /* ------------------------------------------------------------------ */

  OTZ.ui.busy = function busy(button, active, label) {
    if (!button) return;
    if (active) {
      button.dataset.restore = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `${icon('refresh', 'ico spin')} ${esc(label || 'A processar…')}`;
    } else {
      if (button.dataset.restore) button.innerHTML = button.dataset.restore;
      delete button.dataset.restore;
      button.disabled = false;
    }
  };

  function pushActivity(label, detail) {
    state.activity.unshift({ label, detail, at: Date.now() });
    state.activity = state.activity.slice(0, 14);
  }

  function relativeTime(timestamp) {
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 45) return OTZ.i18n.t('agora');
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
    return `${Math.floor(seconds / 86400)} d`;
  }

  function setStatus(text, tone) {
    if (el.statusText) el.statusText.textContent = text;
    if (el.statusDot) el.statusDot.classList.toggle('is-busy', tone === 'busy');
  }

  /* ------------------------------------------------------------------ */
  /* Navegacao                                                          */
  /* ------------------------------------------------------------------ */

  function renderNav() {
    el.tabs.innerHTML = NAV.map((item) => {
      const active = state.page === item.id;
      return `<button class="tab ${active ? 'active' : ''}" type="button" role="tab"
        aria-selected="${active}" data-nav="${item.id}">
        ${icon(item.icon)}<span>${esc(item.label)}</span>
      </button>`;
    }).join('');

    el.rail.innerHTML = NAV.map((item) => {
      const active = state.page === item.id;
      return `<button class="rail-btn ${active ? 'active' : ''}" type="button"
        data-nav="${item.id}" data-tip="${esc(item.label)}" aria-label="${esc(item.label)}">
        ${icon(item.icon)}
      </button>`;
    }).join('');
  }

  function updateChrome() {
    const license = state.license;
    if (!license) return;

    let label = 'ATIVAR';
    let tone = 'is-trial';
    if (license.licensed) {
      label =
        license.plan === 'STAFF'
          ? 'STAFF'
          : license.owner
            ? 'OWNER'
            : license.plan === 'BETA'
              ? 'BETA'
              : 'PRO';
      tone = 'is-pro';
    } else if (license.betaAccess) {
      label = 'BETA';
      tone = 'is-beta';
    } else if (license.trial && license.trial.active) {
      label = `TRIAL ${license.trial.daysLeft}D`;
    }

    el.proPill.textContent = label;
    el.proPill.className = `plan-pill ${tone}`;
    el.proPill.title = license.licensed
      ? `Licenca ${license.planLabel} ativa`
      : 'Ativar ou gerir licenca';

    if (state.info) el.adminPill.hidden = !state.info.isAdmin;
    renderNav();
  }

  async function refreshLicense() {
    try {
      state.license = await api.license.status();
    } catch {
      state.license = null;
    }
    updateChrome();
    return state.license;
  }

  async function navigate(id) {
    const page = OTZ.pages[id];
    if (!page) return;

    if (typeof cleanup === 'function') {
      try {
        cleanup();
      } catch {
        /* ignorado */
      }
    }
    cleanup = null;

    state.page = id;
    renderNav();
    document.title = `Nyx Optmizer · ${OTZ.i18n.t(page.title)}`;

    const wrapper = document.createElement('div');
    wrapper.className = 'page';
    el.view.innerHTML = '';
    el.view.appendChild(wrapper);
    el.view.scrollTop = 0;

    try {
      const result = await page.render(wrapper, context);
      if (typeof result === 'function') cleanup = result;
    } catch (error) {
      wrapper.innerHTML = `<div class="empty">${icon('alert')}<span>Ocorreu um erro a abrir esta pagina.</span></div>`;
      toast({
        type: 'error',
        title: 'Erro na interface',
        text: String(error && error.message ? error.message : error),
      });
    }
  }

  const context = {
    api,
    state,
    navigate,
    refreshLicense,
    pushActivity,
    relativeTime,
    setStatus,
  };

  /* ------------------------------------------------------------------ */
  /* Eventos globais                                                    */
  /* ------------------------------------------------------------------ */

  document.addEventListener('click', (event) => {
    const navTarget = event.target.closest('[data-nav]');
    if (navTarget) {
      navigate(navTarget.dataset.nav);
      return;
    }
    const goto = event.target.closest('[data-goto]');
    if (goto) navigate(goto.dataset.goto);
  });

  document.addEventListener('keydown', (event) => {
    if (!event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target.closest('input, textarea, select')) return;
    const index = Number(event.key) - 1;
    if (index >= 0 && index < NAV.length) {
      event.preventDefault();
      navigate(NAV[index].id);
    }
  });

  document.getElementById('win-min')?.addEventListener('click', () => api.window.minimize());
  document.getElementById('win-max')?.addEventListener('click', () => api.window.toggleMaximize());
  document.getElementById('win-close')?.addEventListener('click', () => api.window.close());

  /* ------------------------------------------------------------------ */
  /* Arranque                                                           */
  /* ------------------------------------------------------------------ */

  async function boot() {
    renderNav();

    api.window.onMaximized?.((maximized) =>
      document.body.classList.toggle('is-maximized', Boolean(maximized))
    );

    if (OTZ.isMock) {
      document.body.classList.add('is-preview');
      el.previewPill.hidden = false;
    }

    try {
      state.info = await api.app.info();
    } catch {
      state.info = { isAdmin: false, version: '1.0.0' };
    }

    el.statusMeta.textContent = `NYX ${state.info.version || '1.0.0'}`;
    setStatus(state.info.isAdmin ? 'Administrador ativo' : 'Sistema pronto');

    let updateAnnounced = false;
    if (api.updater && api.updater.onEvent) {
      api.updater.onEvent((status) => {
        if (!status || status.status !== 'ready' || updateAnnounced) return;
        updateAnnounced = true;
        toast({
          type: 'info',
          title: 'Atualizacao pronta',
          text: `A versao ${status.updateVersion || 'nova'} instala quando fechares a app.`,
        });
      });
    }

    await refreshLicense();
    await navigate('dashboard');
  }

  boot();
})();
