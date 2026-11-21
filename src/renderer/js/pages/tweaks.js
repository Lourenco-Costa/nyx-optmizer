'use strict';

(function () {
  const OTZ = window.OTZ;
  OTZ.pages = OTZ.pages || {};
  const { icon, esc, toast, modal } = OTZ.ui;

  const RISK_LABEL = { seguro: 'Seguro', moderado: 'Moderado' };

  OTZ.pages.tweaks = {
    title: 'Performance',
    sub: 'Ajustes reais do Windows, todos reversiveis',

    async render(root, ctx) {
      const { api, navigate, pushActivity } = ctx;

      root.innerHTML = `
        <div class="page-head">
          <div>
            <span class="eyebrow">Performance</span>
            <h2 class="page-title">Ajustes do sistema</h2>
            <p class="page-sub">Cada tweak le e escreve o estado real do Windows. Nada e simulado.</p>
          </div>
          <div class="page-actions">
            <span class="perf-count" id="perf-count">A carregar…</span>
            <button class="btn btn-ghost btn-sm" id="restore" type="button">${icon('refresh')} Restaurar</button>
          </div>
        </div>

        <div class="admin-banner" id="banner" hidden>
          ${icon('alert')}
          <span id="banner-text">Alguns tweaks precisam de administrador.</span>
          <button class="btn btn-ghost btn-sm" id="elevate" type="button">Reiniciar como admin</button>
        </div>

        <div class="perf-toolbar">
          <label class="search">
            ${icon('search')}
            <input id="search" type="search" placeholder="Procurar ajuste…" autocomplete="off" />
          </label>
          <div class="perf-toolbar-right">
            <div class="seg" id="seg"></div>
          </div>
        </div>

        <div class="tweak-grid" id="grid">
          <div class="skeleton" style="height:154px"></div>
          <div class="skeleton" style="height:154px"></div>
          <div class="skeleton" style="height:154px"></div>
          <div class="skeleton" style="height:154px"></div>
        </div>
      `;

      const refs = {
        banner: root.querySelector('#banner'),
        bannerText: root.querySelector('#banner-text'),
        elevate: root.querySelector('#elevate'),
        search: root.querySelector('#search'),
        seg: root.querySelector('#seg'),
        restore: root.querySelector('#restore'),
        grid: root.querySelector('#grid'),
        count: root.querySelector('#perf-count'),
      };

      let data = { categories: [], tweaks: [], premium: true, beta: false, isAdmin: false };
      let category = 'todos';
      let query = '';

      function segments() {
        const items = [{ id: 'todos', name: 'Todos' }, ...data.categories];
        refs.seg.innerHTML = items
          .map(
            (item) =>
              `<button type="button" data-cat="${item.id}" class="${category === item.id ? 'active' : ''}">${esc(
                item.name
              )}</button>`
          )
          .join('');
      }

      function card(tweak, index) {
        const locked = !data.premium || tweak.locked;
        const chips = [];

        if (tweak.applied) chips.push('<span class="chip success">ATIVO</span>');
        chips.push(`<span class="chip ${tweak.risk === 'moderado' ? 'warn' : ''}">${
          RISK_LABEL[tweak.risk] || 'Seguro'
        }</span>`);
        if (tweak.admin) chips.push(`<span class="chip">${icon('lock')} ADMIN</span>`);
        if (tweak.restart) chips.push('<span class="chip">REINICIO</span>');
        if (tweak.beta) chips.push(`<span class="chip gold">${icon('flask')} BETA</span>`);
        if (locked) chips.push(`<span class="chip gold">${icon('lock')} ${tweak.beta && !data.beta ? 'BETA' : 'PRO'}</span>`);

        return `<article class="tweak-card ${tweak.applied ? 'is-on' : ''} ${locked ? 'is-locked' : ''}" style="--i:${index}">
          <div class="tweak-top">
            <span class="tweak-index">${String(index + 1).padStart(2, '0')}</span>
            <button class="switch" type="button" role="switch" aria-checked="${Boolean(tweak.applied)}"
              data-toggle="${tweak.id}" aria-label="${esc(tweak.name)}"></button>
          </div>
          <h3 class="tweak-name">${esc(tweak.name)}</h3>
          <p class="tweak-desc">${esc(tweak.desc)}</p>
          <div class="tweak-tags">${chips.join('')}</div>
        </article>`;
      }

      function renderGrid() {
        const term = query.trim().toLowerCase();
        const list = data.tweaks.filter((tweak) => {
          if (category !== 'todos' && tweak.category !== category) return false;
          if (!term) return true;
          return `${tweak.name} ${tweak.desc}`.toLowerCase().includes(term);
        });

        refs.count.textContent = `${list.length} de ${data.tweaks.length} ajustes`;

        if (!list.length) {
          refs.grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${icon('search')}<span>Nenhum ajuste corresponde a procura.</span></div>`;
          return;
        }

        refs.grid.innerHTML = list.map((tweak, index) => card(tweak, index)).join('');
      }

      function updateBanner() {
        const showAdmin = data.tweaks.some((tweak) => tweak.admin) && !data.isAdmin;
        const showLicense = !data.premium;
        refs.banner.hidden = !showAdmin && !showLicense;

        if (refs.banner.hidden) return;

        if (showLicense) {
          refs.bannerText.textContent = 'A avaliacao terminou. Ativa uma licenca para aplicar tweaks.';
          refs.elevate.textContent = 'Ativar licenca';
          refs.elevate.dataset.action = 'license';
        } else {
          refs.bannerText.textContent =
            'Modo limitado: os ajustes que escrevem no sistema precisam de administrador.';
          refs.elevate.textContent = 'Reiniciar como administrador';
          refs.elevate.dataset.action = 'elevate';
        }
      }

      async function load() {
        data = OTZ.i18n.localizeCatalog(await api.tweaks.list());
        segments();
        renderGrid();
        updateBanner();
      }

      refs.seg.addEventListener('click', (event) => {
        const button = event.target.closest('[data-cat]');
        if (!button) return;
        category = button.dataset.cat;
        segments();
        renderGrid();
      });

      refs.search.addEventListener('input', () => {
        query = refs.search.value;
        renderGrid();
      });

      refs.grid.addEventListener('click', async (event) => {
        const toggle = event.target.closest('[data-toggle]');
        if (!toggle) return;

        const tweak = data.tweaks.find((item) => item.id === toggle.dataset.toggle);
        if (!tweak) return;

        if (!data.premium) {
          const go = await modal({
            iconName: 'lock',
            title: 'Tweak bloqueado',
            text: 'Este ajuste faz parte do Nyx Pro. Ativa uma licenca para continuar.',
            confirmText: 'Ver licenca',
          });
          if (go) navigate('license');
          return;
        }

        if (tweak.locked) {
          const go = await modal({
            iconName: 'flask',
            title: 'Funcao Owner/Beta',
            text: 'Este tweak faz parte do acesso experimental Owner/Beta.',
            confirmText: 'Ver licenca',
          });
          if (go) navigate('license');
          return;
        }

        const next = toggle.getAttribute('aria-checked') !== 'true';
        toggle.setAttribute('aria-busy', 'true');

        try {
          const result = next ? await api.tweaks.apply(tweak.id) : await api.tweaks.revert(tweak.id);
          if (!result.ok) {
            toast({ type: 'error', title: 'Nao foi possivel', text: result.message });
            if (result.code === 'LICENSE' || result.code === 'BETA') navigate('license');
            if (result.code === 'ADMIN') {
              refs.banner.hidden = false;
              refs.banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            return;
          }

          tweak.applied = next;
          renderGrid();
          toast({
            type: 'success',
            title: next ? 'Tweak aplicado' : 'Tweak revertido',
            text: result.restart ? 'Reinicia o PC para o efeito completo.' : tweak.name,
          });
          pushActivity(next ? 'Tweak aplicado' : 'Tweak revertido', tweak.name);
        } catch (error) {
          toast({ type: 'error', title: 'Erro', text: String(error && error.message ? error.message : error) });
        } finally {
          toggle.removeAttribute('aria-busy');
        }
      });

      refs.elevate.addEventListener('click', async () => {
        if (refs.elevate.dataset.action === 'license') {
          navigate('license');
          return;
        }
        const ok = await api.system.relaunchElevated();
        if (!ok) {
          toast({
            type: 'info',
            title: 'Reinicio cancelado',
            text: 'A app fecha e abre novamente com o pedido de administrador.',
          });
        }
      });

      refs.restore.addEventListener('click', async () => {
        const confirmed = await modal({
          iconName: 'refresh',
          title: 'Restaurar predefinicoes?',
          text: 'Todos os tweaks aplicados voltam ao estado original do Windows.',
          confirmText: 'Restaurar',
          tone: 'danger',
        });
        if (!confirmed) return;

        OTZ.ui.busy(refs.restore, true, 'A restaurar…');
        try {
          const result = await api.tweaks.restoreDefaults();
          if (!result.ok) {
            toast({ type: 'error', title: 'Nao foi possivel', text: result.message });
            return;
          }
          toast({ type: 'success', title: 'Predefinicoes restauradas', text: result.message });
          pushActivity('Tweaks revertidos', `${result.reverted} ajustes`);
          await load();
        } finally {
          OTZ.ui.busy(refs.restore, false);
        }
      });

      await load();
    },
  };
})();
