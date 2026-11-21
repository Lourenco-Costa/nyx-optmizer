'use strict';

/**
 * Laboratorio beta.
 * Tweaks experimentais + ligacoes Google/Discord + acesso por cargo.
 * Abre com chave Owner/Beta ou com o cargo certo no servidor do Otimizador.
 */

(function () {
  const OTZ = window.OTZ;
  OTZ.pages = OTZ.pages || {};
  const { icon, esc, toast, modal } = OTZ.ui;

  const DOCS = {
    discord: { url: 'https://discord.com/developers/applications', label: 'Discord Developer Portal' },
    google: { url: 'https://console.cloud.google.com/apis/credentials', label: 'Google Cloud Console' },
  };

  const GRANT_INFO = {
    role: { label: 'Cargo confirmado · acesso beta ativo', tone: 'ok' },
    'not-configured': { label: 'Servidor e cargo ainda nao configurados', tone: 'warn' },
    'not-member': { label: 'A conta nao esta no servidor', tone: 'warn' },
    'no-role': { label: 'Falta o cargo necessario', tone: 'warn' },
    stale: { label: 'Verificacao expirada', tone: 'warn' },
    'check-failed': { label: 'Nao foi possivel verificar agora', tone: 'warn' },
    'not-checked': { label: 'Cargo ainda nao verificado', tone: 'warn' },
  };

  function grantInfo(grant) {
    if (!grant) return null;
    return GRANT_INFO[grant.reason] || { label: 'Acesso beta por confirmar', tone: 'warn' };
  }

  OTZ.pages.beta = {
    title: 'Laboratorio Beta',
    sub: 'Funcoes experimentais para Owner, testadores e cargos do Discord',

    async render(root, ctx) {
      const { api, state, refreshLicense, navigate, pushActivity } = ctx;
      const license = (await refreshLicense()) || state.license;
      const betaAccess = Boolean(license && license.betaAccess);
      const sourceLabel = license
        ? license.owner
          ? 'Owner'
          : license.plan === 'STAFF'
            ? 'Staff'
            : license.plan === 'BETA'
              ? 'Testador beta'
              : betaAccess
                ? 'Beta via Discord'
                : 'Sem acesso beta'
        : 'Sem licenca';

      let data = { tweaks: [], isAdmin: false };
      let running = false;
      let providers = {};
      let configOpen = null;
      let accessOpen = null;

      root.innerHTML = `
        <section class="card beta-hero spot">
          <div class="beta-hero-main">
            <span class="eyebrow">Laboratorio beta</span>
            <h2>Funcoes experimentais</h2>
            <p>Tweaks em teste e ligacoes de conta para o servidor do Otimizador. O acesso abre com uma chave Owner/Beta ou com o cargo certo no Discord.</p>
            <div class="beta-chips" id="beta-chips"></div>
          </div>
          <div class="beta-hero-actions" id="beta-actions" ${betaAccess ? '' : 'hidden'}>
            <button class="btn btn-primary" id="beta-all" type="button">${icon('bolt')} Aplicar tudo</button>
            <button class="btn btn-ghost" id="beta-revert" type="button">${icon('refresh')} Reverter</button>
          </div>
        </section>

        <div class="admin-banner" id="beta-admin" hidden>
          ${icon('alert')}
          <span>Estes tweaks escrevem no sistema e precisam de administrador.</span>
          <button class="btn btn-ghost btn-sm" id="beta-elevate" type="button">Reiniciar como administrador</button>
        </div>

        <div class="section-head">
          <h3>Tweaks experimentais</h3>
          <span class="hint" id="beta-count"></span>
        </div>
        ${
          betaAccess
            ? '<div class="tweak-grid" id="beta-grid"></div>'
            : `<section class="card beta-gate">
                <span class="beta-gate-icon">${icon('flask')}</span>
                <h3>Laboratorio bloqueado</h3>
                <p>Liga o Discord abaixo: se tiveres o <b>cargo</b> no servidor do Otimizador, o laboratorio abre automaticamente. Tambem podes ativar uma chave Owner ou Beta.</p>
                <button class="btn btn-primary" type="button" data-goto="license">${icon('key')} Ativar uma chave</button>
              </section>`
        }

        <div class="section-head">
          <h3>Ligacoes beta</h3>
          <span class="hint">Google e Discord para o servidor da comunidade</span>
        </div>
        <div class="link-grid" id="links-grid"></div>
        <p class="link-note" id="links-note"></p>
      `;

      const refs = {
        chips: root.querySelector('#beta-chips'),
        actions: root.querySelector('#beta-actions'),
        all: root.querySelector('#beta-all'),
        revert: root.querySelector('#beta-revert'),
        admin: root.querySelector('#beta-admin'),
        elevate: root.querySelector('#beta-elevate'),
        count: root.querySelector('#beta-count'),
        grid: root.querySelector('#beta-grid'),
        links: root.querySelector('#links-grid'),
        note: root.querySelector('#links-note'),
      };

      const betaTweaks = () => data.tweaks.filter((tweak) => tweak.beta);

      function renderGrid() {
        const list = betaTweaks();
        const applied = list.filter((tweak) => tweak.applied).length;

        refs.chips.innerHTML = `
          <span class="chip ${betaAccess ? 'accent' : ''}">${icon('flask')} ${esc(sourceLabel)}</span>
          ${
            betaAccess
              ? `<span class="chip">${applied} de ${list.length} ativos</span><span class="chip success">${icon('shield')} Reversivel</span>`
              : '<span class="chip">Chave Staff, Owner/Beta ou cargo Discord</span>'
          }`;
        refs.count.textContent = betaAccess
          ? `${list.length} funcoes · estado lido do Windows`
          : 'Acesso por chave ou cargo no servidor';

        if (!refs.grid) return;

        if (!list.length) {
          refs.grid.innerHTML = `<div class="card pad empty" style="grid-column:1/-1">${icon('flask')}<span>Sem tweaks beta neste build.</span></div>`;
          return;
        }

        refs.grid.innerHTML = list
          .map(
            (tweak) => `<article class="tweak card spot" data-id="${tweak.id}">
              <div class="tweak-body">
                <div class="tweak-title">${esc(tweak.name)}</div>
                <p class="tweak-desc">${esc(tweak.desc)}</p>
                <div class="tweak-tags">
                  ${tweak.applied ? '<span class="chip success">Ativo</span>' : ''}
                  <span class="chip accent">${icon('flask')} Beta</span>
                  ${tweak.admin ? `<span class="chip">${icon('lock')} Admin</span>` : ''}
                  ${tweak.restart ? '<span class="chip accent">Reinicio</span>' : ''}
                </div>
              </div>
              <button class="switch" type="button" role="switch" aria-checked="${tweak.applied}"
                data-toggle="${tweak.id}" aria-label="${esc(tweak.name)}"></button>
            </article>`
          )
          .join('');
      }

      function linkMeta(provider) {
        const account = provider.account;
        if (!account) {
          return provider.configured ? 'Credenciais guardadas. Pronto a ligar.' : 'Ainda sem credenciais da app.';
        }
        if (provider.id === 'discord') {
          const base = `@${account.handle || account.name}`;
          return account.guildCount
            ? `${base} · ${account.guildCount} ${account.guildCount === 1 ? 'servidor' : 'servidores'}`
            : base;
        }
        return account.email || 'Conta Google ligada';
      }

      function configForm(provider) {
        const docs = DOCS[provider.id];
        return `<form class="link-config" data-form="${provider.id}">
          <label class="field">${icon('key')}<input name="clientId" value="${esc(provider.clientId || '')}" placeholder="Client ID" autocomplete="off" spellcheck="false" /></label>
          <label class="field">${icon('lock')}<input name="clientSecret" type="password" placeholder="Client Secret" autocomplete="new-password" /></label>
          <div class="link-config-foot">
            <span class="hint">Redirect: <code>${esc(provider.redirectUri)}</code></span>
            <button class="btn btn-primary btn-sm" type="submit">Guardar</button>
          </div>
          <p class="link-note">Cria a app em <button type="button" class="link-btn" data-docs="${docs.url}">${esc(docs.label)}</button> e autoriza o redirect acima. O segredo fica cifrado neste PC.</p>
        </form>`;
      }

      function accessForm(provider) {
        const access = provider.access || {};
        return `<form class="link-config" data-access="discord">
          <div class="link-config-foot">
            <span class="hint">Servidor + cargo que dao acesso beta</span>
          </div>
          <label class="field">${icon('shield')}<input name="guildId" value="${esc(access.guildId || '')}" placeholder="Server ID" autocomplete="off" spellcheck="false" /></label>
          <label class="field">${icon('key')}<input name="roleId" value="${esc(access.roleId || '')}" placeholder="Role ID" autocomplete="off" spellcheck="false" /></label>
          <div class="link-config-foot">
            <span class="hint">Botao direito no servidor/cargo → Copiar ID</span>
            <button class="btn btn-primary btn-sm" type="submit">Guardar acesso</button>
          </div>
        </form>`;
      }

      function renderLinks() {
        refs.links.innerHTML = ['discord', 'google']
          .map((id) => {
            const provider = providers[id];
            if (!provider) return '';
            const account = provider.account;
            const grant = id === 'discord' ? grantInfo(provider.grant) : null;
            const guilds = account && id === 'discord' && Array.isArray(account.guilds) ? account.guilds : [];
            const accessConfigured = Boolean(provider.access && provider.access.configured);
            return `<article class="link-card card spot" data-provider="${id}">
              <div class="link-head">
                <span class="link-logo ${id}">${id === 'discord' ? 'D' : 'G'}</span>
                <div class="link-id">
                  <div class="link-name">${esc(provider.label)}</div>
                  <div class="link-account">${esc(linkMeta(provider))}</div>
                </div>
                <span class="chip ${provider.connected ? 'success' : provider.configured ? 'accent' : ''}">
                  ${provider.connected ? 'Ligado' : provider.configured ? 'Pronto' : 'Por configurar'}
                </span>
              </div>
              ${grant ? `<div class="link-grant ${grant.tone}">${icon('shield')} ${esc(grant.label)}</div>` : ''}
              <div class="link-actions">
                ${
                  provider.connected
                    ? `<button class="btn btn-ghost btn-sm" type="button" data-disconnect="${id}">Desligar</button>`
                    : `<button class="btn btn-primary btn-sm" type="button" data-connect="${id}" ${provider.configured ? '' : 'disabled'}>${icon('link')} Ligar conta</button>`
                }
                ${id === 'discord' && provider.connected ? `<button class="btn btn-ghost btn-sm" type="button" data-refresh="${id}">${icon('refresh')} Verificar acesso</button>` : ''}
                ${
                  license.owner
                    ? `<button class="btn btn-ghost btn-sm" type="button" data-config="${id}">${provider.configured ? 'Credenciais' : 'Configurar'}</button>`
                    : ''
                }
                ${
                  id === 'discord' && license.owner
                    ? `<button class="btn btn-ghost btn-sm" type="button" data-access-toggle="${id}">${accessConfigured ? 'Acesso beta' : 'Definir acesso'}</button>`
                    : ''
                }
              </div>
              ${guilds.length ? `<div class="link-guilds">${guilds.slice(0, 3).map((guild) => `<span class="chip">${esc(guild.name)}</span>`).join('')}${guilds.length > 3 ? `<span class="chip">+${guilds.length - 3}</span>` : ''}</div>` : ''}
              ${!license.owner && id === 'discord' ? `<p class="link-note">${accessConfigured ? 'O acesso beta e definido pelo servidor do Otimizador.' : 'O Owner ainda nao configurou o servidor de acesso beta.'}</p>` : ''}
              ${accessOpen === id ? accessForm(provider) : ''}
              ${configOpen === id ? configForm(provider) : ''}
            </article>`;
          })
          .join('');

        const first = providers.discord || providers.google;
        refs.note.innerHTML = first
          ? `${icon('shield')} Redirect a autorizar nas apps: <code>${esc(first.redirectUri)}</code> · os tokens ficam cifrados neste PC.`
          : '';
      }

      async function load() {
        data = await api.tweaks.list();
        renderGrid();
        if (refs.admin) refs.admin.hidden = !betaAccess || Boolean(data.isAdmin);
      }

      async function loadLinks() {
        if (!api.links) {
          refs.links.innerHTML = `<div class="card pad empty" style="grid-column:1/-1">${icon('link')}<span>Ligacoes indisponiveis neste build.</span></div>`;
          return;
        }
        const result = await api.links.status();
        if (!result.ok) {
          providers = {};
          refs.links.innerHTML = `<div class="card pad empty" style="grid-column:1/-1">${icon('link')}<span>${esc(result.message || 'Ligacoes indisponiveis.')}</span></div>`;
          refs.note.textContent = '';
          return;
        }
        providers = result.providers || {};
        renderLinks();
      }

      async function afterAccessChange() {
        const updated = await refreshLicense();
        await loadLinks();
        if (updated && updated.betaAccess && !betaAccess) {
          navigate('beta');
          return true;
        }
        return false;
      }

      async function toggleTweak(tweak, button) {
        const next = button.getAttribute('aria-checked') !== 'true';
        button.setAttribute('aria-busy', 'true');
        const result = next ? await api.tweaks.apply(tweak.id) : await api.tweaks.revert(tweak.id);
        button.removeAttribute('aria-busy');

        if (!result.ok) {
          toast({ type: 'error', title: 'Nao foi possivel', text: result.message });
          if (result.code === 'ADMIN') {
            refs.admin.hidden = false;
            refs.admin.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          if (result.code === 'BETA' || result.code === 'LICENSE') navigate('license');
          return;
        }

        tweak.applied = next;
        button.setAttribute('aria-checked', String(next));
        renderGrid();
        toast({
          type: 'success',
          title: next ? 'Funcao beta ativa' : 'Funcao beta revertida',
          text: result.restart ? 'Reinicia o PC para o efeito completo.' : tweak.name,
        });
        pushActivity(next ? 'Beta aplicado' : 'Beta revertido', tweak.name);
      }

      async function connectProvider(id, button) {
        if (!providers[id]) return;
        OTZ.ui.busy(button, true, 'A ligar…');
        const result = await api.links.connect(id);
        if (!result.ok) {
          toast({ type: 'error', title: 'Ligacao falhou', text: result.message });
          if (result.code === 'CONFIG') configOpen = id;
          await loadLinks();
          return;
        }
        toast({
          type: 'success',
          title: 'Conta ligada',
          text: `${providers[id]?.label || id}: ${result.account?.name || 'conta ligada'}`,
        });
        pushActivity('Conta ligada', providers[id]?.label || id);
        await afterAccessChange();
      }

      async function refreshGrant(button) {
        OTZ.ui.busy(button, true, 'A verificar…');
        const result = await api.links.refreshAccess();
        if (!result.ok) {
          toast({ type: 'error', title: 'Verificacao falhou', text: result.message });
          if (result.code === 'CONFIG') accessOpen = 'discord';
          await loadLinks();
          return;
        }
        toast({ type: 'success', title: 'Verificacao Discord', text: result.message });
        await afterAccessChange();
      }

      async function disconnectProvider(id) {
        const provider = providers[id];
        if (!provider) return;
        const confirmed = await modal({
          iconName: 'link',
          title: `Desligar ${provider.label}?`,
          text: 'A conta, os tokens e a verificacao de cargo guardados neste PC sao removidos. Podes voltar a ligar quando quiseres.',
          confirmText: 'Desligar',
          tone: 'danger',
        });
        if (!confirmed) return;
        const result = await api.links.disconnect(id);
        if (!result.ok) {
          toast({ type: 'error', title: 'Nao foi possivel', text: result.message });
          return;
        }
        toast({ type: 'info', title: `${provider.label} desligado` });
        pushActivity('Conta desligada', provider.label);
        await refreshLicense();
        await loadLinks();
        navigate('beta');
      }

      if (refs.grid) {
        refs.grid.addEventListener('click', async (event) => {
          const button = event.target.closest('[data-toggle]');
          if (!button) return;
          const tweak = data.tweaks.find((item) => item.id === button.dataset.toggle);
          if (!tweak) return;
          await toggleTweak(tweak, button);
        });
      }

      refs.links.addEventListener('click', async (event) => {
        const docs = event.target.closest('[data-docs]');
        if (docs) {
          await api.app.openExternal(docs.dataset.docs);
          return;
        }
        const accessToggle = event.target.closest('[data-access-toggle]');
        if (accessToggle) {
          accessOpen = accessOpen === accessToggle.dataset.accessToggle ? null : accessToggle.dataset.accessToggle;
          configOpen = null;
          renderLinks();
          return;
        }
        const config = event.target.closest('[data-config]');
        if (config) {
          configOpen = configOpen === config.dataset.config ? null : config.dataset.config;
          accessOpen = null;
          renderLinks();
          return;
        }
        const connect = event.target.closest('[data-connect]');
        if (connect) {
          await connectProvider(connect.dataset.connect, connect);
          return;
        }
        const refresh = event.target.closest('[data-refresh]');
        if (refresh) {
          await refreshGrant(refresh);
          return;
        }
        const disconnect = event.target.closest('[data-disconnect]');
        if (disconnect) await disconnectProvider(disconnect.dataset.disconnect);
      });

      refs.links.addEventListener('submit', async (event) => {
        const accessFormEl = event.target.closest('[data-access]');
        if (accessFormEl) {
          event.preventDefault();
          const values = new FormData(accessFormEl);
          const button = accessFormEl.querySelector('button[type="submit"]');
          OTZ.ui.busy(button, true, 'A guardar…');
          const result = await api.links.configureAccess({
            guildId: values.get('guildId'),
            roleId: values.get('roleId'),
          });
          OTZ.ui.busy(button, false);
          if (!result.ok) {
            toast({ type: 'error', title: 'Acesso recusado', text: result.message });
            return;
          }
          providers = result.providers || providers;
          accessOpen = null;
          toast({ type: 'success', title: 'Acesso beta configurado', text: result.message });
          await afterAccessChange();
          renderLinks();
          return;
        }

        const form = event.target.closest('[data-form]');
        if (!form) return;
        event.preventDefault();
        const provider = form.dataset.form;
        const values = new FormData(form);
        const button = form.querySelector('button[type="submit"]');
        OTZ.ui.busy(button, true, 'A guardar…');
        const result = await api.links.configure(provider, {
          clientId: values.get('clientId'),
          clientSecret: values.get('clientSecret'),
        });
        if (!result.ok) {
          OTZ.ui.busy(button, false);
          toast({ type: 'error', title: 'Credenciais recusadas', text: result.message });
          return;
        }
        providers = result.providers || providers;
        if (configOpen === provider) configOpen = null;
        renderLinks();
        toast({ type: 'success', title: 'Credenciais guardadas', text: result.message });
      });

      refs.all?.addEventListener('click', async () => {
        if (running) return;
        const pending = betaTweaks().filter((tweak) => !tweak.applied);
        if (!pending.length) {
          toast({ type: 'info', title: 'Tudo aplicado', text: 'Nao ha funcoes beta por aplicar.' });
          return;
        }

        const confirmed = await modal({
          iconName: 'flask',
          title: 'Aplicar todos os tweaks beta?',
          text: `Vao ser aplicados ${pending.length} ajustes experimentais. Podes revertê-los de seguida.`,
          confirmText: 'Aplicar',
        });
        if (!confirmed) return;

        running = true;
        OTZ.ui.busy(refs.all, true, 'A aplicar…');
        let ok = 0;
        let failed = 0;
        for (const tweak of pending) {
          const result = await api.tweaks.apply(tweak.id);
          if (result.ok) ok += 1;
          else failed += 1;
        }
        OTZ.ui.busy(refs.all, false);
        running = false;
        await load();

        toast({
          type: failed ? 'warn' : 'success',
          title: 'Laboratorio beta',
          text: `${ok} aplicados${failed ? `, ${failed} falharam (administrador?)` : ''}.`,
        });
        if (ok) pushActivity('Beta aplicado', `${ok} ajustes`);
      });

      refs.revert?.addEventListener('click', async () => {
        const list = betaTweaks().filter((tweak) => tweak.applied);
        if (!list.length) {
          toast({ type: 'info', title: 'Nada para reverter', text: 'Nenhum tweak beta esta ativo.' });
          return;
        }

        const confirmed = await modal({
          iconName: 'refresh',
          title: 'Reverter tweaks beta?',
          text: 'Todos os ajustes experimentais ativos voltam ao estado original do Windows.',
          confirmText: 'Reverter',
          tone: 'danger',
        });
        if (!confirmed) return;

        OTZ.ui.busy(refs.revert, true, 'A reverter…');
        let ok = 0;
        for (const tweak of list) {
          const result = await api.tweaks.revert(tweak.id);
          if (result.ok) ok += 1;
        }
        OTZ.ui.busy(refs.revert, false);
        await load();

        toast({ type: 'success', title: 'Tweaks revertidos', text: `${ok} ajustes voltaram ao original.` });
        pushActivity('Beta revertido', `${ok} ajustes`);
      });

      refs.elevate?.addEventListener('click', () => api.system.relaunchElevated());

      await Promise.all([load(), loadLinks()]);
    },
  };
})();
