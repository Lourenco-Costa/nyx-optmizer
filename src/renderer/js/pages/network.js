'use strict';

(function () {
  const OTZ = window.OTZ;
  OTZ.pages = OTZ.pages || {};
  const { icon, esc, animateNumber, toast, modal } = OTZ.ui;

  const NET_IDS = ['multimedia-profile', 'game-mode', 'gamebar', 'gpu-scheduling'];
  const INITIAL_BARS = [28, 42, 36, 55, 32, 48, 60, 40, 34, 52, 44, 38, 58, 46, 30, 50, 42, 36, 54, 48, 40, 32, 46, 38];

  OTZ.pages.network = {
    title: 'Network',
    sub: 'Latencia e resposta da ligacao',

    async render(root, ctx) {
      const { api, navigate, pushActivity, setStatus } = ctx;

      root.innerHTML = `
        <div class="page-head">
          <div>
            <span class="eyebrow">Network</span>
            <h2 class="page-title">Latencia sob controlo.</h2>
            <p class="page-sub">Mede a resposta real da tua ligacao e aplica ajustes de rede e gaming.</p>
          </div>
          <span class="chip" id="net-chip">SEM TESTE</span>
        </div>

        <div class="net-grid">
          <section class="ping-card">
            <div class="ping-head">
              <span class="eyebrow">Teste de latencia</span>
              <span class="ping-host">1.1.1.1 · Cloudflare</span>
            </div>
            <div class="ping-value"><span id="ping-value">--</span><span class="ping-unit">ms</span></div>
            <div class="ping-label" id="ping-label">Testa a resposta da tua ligacao.</div>
            <div class="latency-bars" id="bars">
              ${INITIAL_BARS.map((height) => `<i style="--h:${height}%" class="${height > 55 ? 'hot' : ''}"></i>`).join('')}
            </div>
            <div class="ping-stats">
              <div class="ping-stat">Jitter <b id="ping-jitter">--</b></div>
              <div class="ping-stat">Perda <b id="ping-loss">--</b></div>
              <div class="ping-stat">Pacotes <b>4</b></div>
            </div>
            <div class="ping-actions">
              <button class="btn btn-light btn-sm" id="ping" type="button">${icon('activity')} Testar latencia</button>
              <span class="hint">Ping real via Windows</span>
            </div>
          </section>

          <div class="net-side">
            <section class="card pad dns-card">
              <div class="dns-top">
                <span class="icon-box">${icon('wifi')}</span>
                <div>
                  <div class="dns-title">Cache DNS</div>
                  <div class="dns-desc">Remove resolucoes antigas e forca o Windows a procurar os servidores atuais.</div>
                </div>
              </div>
              <div class="dns-actions">
                <span class="chip">Seguro</span>
                <button class="btn btn-sm" id="dns" type="button">${icon('refresh')} Limpar cache</button>
              </div>
            </section>

            <section class="card pad net-tweak-card">
              <div class="dns-top">
                <span class="icon-box">${icon('flame')}</span>
                <div>
                  <div class="dns-title">Modo gaming</div>
                  <div class="dns-desc">Prioridade para o jogo em primeiro plano, sem throttling de rede.</div>
                </div>
              </div>
              <div class="dns-actions">
                <span class="chip">GPU + CPU</span>
                <button class="btn btn-ghost btn-sm" type="button" data-goto="tweaks">Ver ajustes ${icon('arrowRight')}</button>
              </div>
            </section>
          </div>
        </div>

        <div class="section-head">
          <h3>Ajustes de latencia</h3>
          <span class="hint">Recomendado para gaming</span>
        </div>
        <div class="net-tweaks" id="net-tweaks">
          <div class="skeleton" style="height:62px"></div>
          <div class="skeleton" style="height:62px"></div>
        </div>
      `;

      const refs = {
        ping: root.querySelector('#ping'),
        value: root.querySelector('#ping-value'),
        label: root.querySelector('#ping-label'),
        jitter: root.querySelector('#ping-jitter'),
        loss: root.querySelector('#ping-loss'),
        bars: root.querySelector('#bars'),
        chip: root.querySelector('#net-chip'),
        dns: root.querySelector('#dns'),
        tweaks: root.querySelector('#net-tweaks'),
      };

      let catalog = null;

      function paintBars(samples) {
        const list = samples && samples.length ? samples : [28];
        const wave = [0, 8, -3, 5, -6, 2, 10, -1, 6, -4, 3, 7, -5, 4, 9, -2, 5, -7, 6, 1, -3, 5, -1, 8];
        refs.bars.innerHTML = Array.from({ length: 24 }, (_, index) => {
          const sample = Number(list[index % list.length]);
          const base = Math.max(14, Math.min(82, Math.round(94 - sample * 0.9)));
          const height = Math.max(10, Math.min(94, base + wave[index]));
          return `<i style="--h:${height}%" class="${height > 72 ? 'hot' : ''}"></i>`;
        }).join('');
      }

      async function ping() {
        if (!api.network || typeof api.network.ping !== 'function') {
          toast({
            type: 'error',
            title: 'Teste indisponivel',
            text: 'Esta versao da app nao expoe o teste de latencia.',
          });
          return;
        }

        OTZ.ui.busy(refs.ping, true, 'A medir…');
        setStatus('A medir a latencia', 'busy');

        try {
          const result = await api.network.ping();
          if (!result || !result.ok) {
            refs.label.textContent = (result && result.message) || 'Sem resposta do servidor.';
            refs.chip.textContent = 'OFFLINE';
            refs.chip.className = 'chip warn';
            toast({ type: 'error', title: 'Sem resposta', text: refs.label.textContent });
            return;
          }

          animateNumber(refs.value, result.avg, { duration: 700 });
          refs.jitter.textContent = `${result.jitter || 0} ms`;
          refs.loss.textContent = `${result.loss || 0}%`;
          refs.label.textContent =
            result.loss > 0
              ? 'Ligacao instavel. Repete o teste.'
              : result.avg < 40
                ? 'Resposta rapida. Boa ligacao para jogar.'
                : 'Resposta aceitavel, mas ha margem para melhorar.';
          refs.chip.textContent = 'ONLINE';
          refs.chip.className = 'chip success';
          paintBars(result.samples);
          setStatus('Sistema pronto');
          pushActivity('Teste de latencia', `${result.avg} ms · jitter ${result.jitter || 0} ms`);
        } catch (error) {
          refs.label.textContent = 'Nao foi possivel medir agora.';
          refs.chip.textContent = 'ERRO';
          refs.chip.className = 'chip warn';
          toast({ type: 'error', title: 'Falha no teste', text: String(error && error.message ? error.message : error) });
          setStatus('Sistema pronto');
        } finally {
          OTZ.ui.busy(refs.ping, false);
        }
      }

      async function loadTweaks() {
        try {
          catalog = OTZ.i18n.localizeCatalog(await api.tweaks.list());
          const list = NET_IDS.map((id) => (catalog.tweaks || []).find((tweak) => tweak.id === id)).filter(Boolean);

          if (!list.length) {
            refs.tweaks.innerHTML = `<div class="empty" style="grid-column:1/-1">${icon('flame')}<span>Sem ajustes de rede disponiveis neste Windows.</span></div>`;
            return;
          }

          refs.tweaks.innerHTML = list
            .map(
              (tweak, index) => `<article class="net-tweak" style="--i:${index}">
                <span class="icon-box">${icon(tweak.category === 'gaming' ? 'flame' : 'router')}</span>
                <div class="net-tweak-body">
                  <div class="net-tweak-name">${esc(tweak.name)}</div>
                  <div class="net-tweak-desc">${esc(tweak.desc)}</div>
                </div>
                <button class="switch" type="button" role="switch" aria-checked="${Boolean(tweak.applied)}"
                  data-toggle="${tweak.id}" aria-label="${esc(tweak.name)}"></button>
              </article>`
            )
            .join('');
        } catch {
          refs.tweaks.innerHTML = `<div class="empty" style="grid-column:1/-1">${icon('alert')}<span>Nao foi possivel carregar os ajustes de rede.</span></div>`;
        }
      }

      refs.ping.addEventListener('click', ping);

      refs.dns.addEventListener('click', async () => {
        OTZ.ui.busy(refs.dns, true, 'A limpar…');
        try {
          const result = await api.system.flushDns();
          toast({
            type: result.ok ? 'success' : 'error',
            title: result.ok ? 'Cache DNS limpa' : 'Falha ao limpar DNS',
            text: result.message || '',
          });
          if (result.ok) pushActivity('Cache DNS limpa', 'Resolucao de nomes atualizada');
        } finally {
          OTZ.ui.busy(refs.dns, false);
        }
      });

      refs.tweaks.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-toggle]');
        if (!button || !catalog) return;

        const tweak = catalog.tweaks.find((item) => item.id === button.dataset.toggle);
        if (!tweak) return;

        if (!catalog.premium) {
          const go = await modal({
            iconName: 'lock',
            title: 'Ajuste bloqueado',
            text: 'Ativa uma licenca para aplicares ajustes de rede e gaming.',
            confirmText: 'Ver licenca',
          });
          if (go) navigate('license');
          return;
        }

        if (tweak.locked) {
          const go = await modal({
            iconName: 'flask',
            title: 'Funcao Owner/Beta',
            text: 'Este ajuste faz parte do acesso experimental.',
            confirmText: 'Ver licenca',
          });
          if (go) navigate('license');
          return;
        }

        const next = button.getAttribute('aria-checked') !== 'true';
        button.setAttribute('aria-busy', 'true');

        try {
          const result = next ? await api.tweaks.apply(tweak.id) : await api.tweaks.revert(tweak.id);
          if (!result.ok) {
            toast({ type: 'error', title: 'Nao foi possivel', text: result.message });
            if (result.code === 'ADMIN') {
              toast({
                type: 'info',
                title: 'Precisas de administrador',
                text: 'Reinicia a app como admin nas Definicoes para aplicares este ajuste.',
              });
            }
            return;
          }

          tweak.applied = next;
          button.setAttribute('aria-checked', String(next));
          pushActivity(next ? 'Ajuste de rede aplicado' : 'Ajuste de rede revertido', tweak.name);
          toast({
            type: 'success',
            title: next ? 'Ajuste aplicado' : 'Ajuste revertido',
            text: result.restart ? 'Reinicia o PC para o efeito completo.' : tweak.name,
          });
        } catch (error) {
          toast({ type: 'error', title: 'Erro', text: String(error && error.message ? error.message : error) });
        } finally {
          button.removeAttribute('aria-busy');
        }
      });

      await loadTweaks();
      await ping();
    },
  };
})();
