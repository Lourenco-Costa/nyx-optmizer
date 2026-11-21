'use strict';

(function () {
  const OTZ = window.OTZ;
  OTZ.pages = OTZ.pages || {};
  const { icon, esc, fmtBytes, fmtUptime, animateNumber, toast, modal } = OTZ.ui;

  const CATEGORY_ICON = { desempenho: 'bolt', gaming: 'flame', privacidade: 'shield', sistema: 'gear' };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  OTZ.pages.dashboard = {
    title: 'Smart',
    sub: 'Visao inteligente do sistema',

    async render(root, ctx) {
      const { api, state, navigate, pushActivity, relativeTime, setStatus } = ctx;

      root.innerHTML = `
        <div class="perf-toolbar" style="margin-bottom:12px">
          <span class="eyebrow">Smart scan</span>
          <button class="btn btn-ghost btn-sm" id="refresh" type="button">${icon('refresh')} Atualizar</button>
        </div>

        <section class="smart-hero">
          <div class="hero-copy">
            <span class="hero-kicker"><i></i> Analise concluida</span>
            <h2 class="hero-title">Mais FPS.<br>Menos latencia.</h2>
            <p class="hero-text">
              O Nyx le o teu sistema, limpa o que sobra e aplica apenas ajustes seguros.
              Tu mantens o controlo — tudo pode ser revertido.
            </p>
            <div class="hero-actions">
              <button class="btn btn-light btn-lg" id="optimize" type="button">
                ${icon('bolt')} Otimizar agora ${icon('arrowRight')}
              </button>
              <span class="hero-note" id="hero-note">A preparar recomendacoes…</span>
            </div>
            <div class="hero-tags">
              <span class="hero-tag" id="tag-os">Windows</span>
              <span class="hero-tag">Tweaks reversiveis</span>
              <span class="hero-tag" id="tag-admin">Modo limitado</span>
            </div>
          </div>

          <div class="hero-visual">
            <div class="orbit orbit-a"></div>
            <div class="orbit orbit-b"></div>
            <div class="score-orb">
              <svg class="score-ring" viewBox="0 0 200 200">
                <circle class="track" cx="100" cy="100" r="94" pathLength="100" />
                <circle class="value" id="score-ring" cx="100" cy="100" r="94" pathLength="100" />
              </svg>
              <div class="score-core">
                <span class="score-value" id="score">--</span>
                <span class="score-caption">SYSTEM SCORE</span>
              </div>
            </div>
            <span class="float-tag tag-a">CPU <b id="tag-cpu">--</b></span>
            <span class="float-tag tag-b">RAM <b id="tag-ram">--</b></span>
          </div>
        </section>

        <div class="stat-grid">
          <article class="stat-card">
            <div class="stat-label">${icon('cpu')} CPU</div>
            <div class="stat-value"><span id="cpu-value">--</span><small>%</small></div>
            <div class="meter"><i id="cpu-bar"></i></div>
            <div class="stat-foot" id="cpu-foot">A ler o processador…</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">${icon('memory')} Memoria</div>
            <div class="stat-value"><span id="mem-value">--</span><small>%</small></div>
            <div class="meter"><i id="mem-bar"></i></div>
            <div class="stat-foot" id="mem-foot">A ler a memoria…</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">${icon('disk')} Disco</div>
            <div class="stat-value"><span id="disk-value">--</span><small>%</small></div>
            <div class="meter"><i id="disk-bar"></i></div>
            <div class="stat-foot" id="disk-foot">A ler o disco…</div>
          </article>
          <article class="stat-card">
            <div class="stat-label">${icon('clock')} Tempo ligado</div>
            <div class="stat-value" id="up-value">--</div>
            <div class="stat-foot" id="up-foot">A ler o sistema…</div>
          </article>
        </div>

        <div class="section-head">
          <h3>Recomendado para ti</h3>
          <button class="btn btn-ghost btn-sm" type="button" data-goto="tweaks">
            Ver todos ${icon('arrowRight')}
          </button>
        </div>
        <div class="rec-list" id="rec-list">
          <div class="skeleton" style="height:58px"></div>
          <div class="skeleton" style="height:58px"></div>
          <div class="skeleton" style="height:58px"></div>
        </div>

        <div class="section-head">
          <h3>Atividade</h3>
          <span class="hint">Sessao atual</span>
        </div>
        <div class="activity" id="feed"></div>
      `;

      const refs = {
        score: root.querySelector('#score'),
        scoreRing: root.querySelector('#score-ring'),
        heroNote: root.querySelector('#hero-note'),
        tagOs: root.querySelector('#tag-os'),
        tagAdmin: root.querySelector('#tag-admin'),
        tagCpu: root.querySelector('#tag-cpu'),
        tagRam: root.querySelector('#tag-ram'),
        cpuValue: root.querySelector('#cpu-value'),
        cpuBar: root.querySelector('#cpu-bar'),
        cpuFoot: root.querySelector('#cpu-foot'),
        memValue: root.querySelector('#mem-value'),
        memBar: root.querySelector('#mem-bar'),
        memFoot: root.querySelector('#mem-foot'),
        diskValue: root.querySelector('#disk-value'),
        diskBar: root.querySelector('#disk-bar'),
        diskFoot: root.querySelector('#disk-foot'),
        upValue: root.querySelector('#up-value'),
        upFoot: root.querySelector('#up-foot'),
        optimize: root.querySelector('#optimize'),
        refresh: root.querySelector('#refresh'),
        recList: root.querySelector('#rec-list'),
        feed: root.querySelector('#feed'),
      };

      let timer = null;
      let catalog = null;
      let lastStats = null;
      let recommendedCount = 0;

      function updateHeroNote() {
        if (!lastStats) return;
        const grade = lastStats.grade && lastStats.grade.label
          ? OTZ.i18n.t(lastStats.grade.label)
          : OTZ.i18n.t('Analisado');
        refs.heroNote.textContent = `${grade} · ${recommendedCount} ajustes por aplicar`;
      }

      function paintStats(data) {
        lastStats = data;
        refs.scoreRing.style.setProperty('--score', String(data.score || 0));
        animateNumber(refs.score, data.score || 0, { duration: 1000 });

        const cpu = Math.round(data.cpu.usage || 0);
        const mem = Math.round(data.memory.percent || 0);
        const disk = Math.round(data.disk.percent || 0);

        refs.cpuValue.textContent = String(cpu);
        refs.cpuBar.style.setProperty('--p', `${cpu}%`);
        refs.cpuFoot.textContent = data.cpu.model || 'Processador';

        refs.memValue.textContent = String(mem);
        refs.memBar.style.setProperty('--p', `${mem}%`);
        refs.memFoot.textContent = `${fmtBytes(data.memory.used)} de ${fmtBytes(data.memory.total)}`;

        refs.diskValue.textContent = String(disk);
        refs.diskBar.style.setProperty('--p', `${disk}%`);
        refs.diskFoot.textContent = `${fmtBytes(data.disk.free)} livres em ${data.disk.letter || 'C:'}`;

        refs.upValue.textContent = fmtUptime(data.uptime);
        refs.upFoot.textContent = data.hostname || 'Este PC';

        refs.tagCpu.textContent = `${cpu}%`;
        refs.tagRam.textContent = `${mem}%`;
        refs.tagOs.textContent = data.platform || 'Windows';
        refs.tagAdmin.textContent = data.isAdmin ? 'Administrador' : 'Modo limitado';

        updateHeroNote();
      }

      async function loadStats() {
        try {
          paintStats(await api.stats());
        } catch {
          /* mantem os ultimos valores */
        }
      }

      function renderFeed() {
        if (!state.activity.length) {
          refs.feed.innerHTML = `<div class="empty" style="min-height:92px;border:0">
            ${icon('clock')}<span>Sem atividade ainda. Aplica um tweak ou corre uma otimizacao.</span>
          </div>`;
          return;
        }

        refs.feed.innerHTML = state.activity
          .slice(0, 6)
          .map(
            (item) => `<div class="activity-item">
              <span class="activity-dot"></span>
              <div class="activity-body">
                <div class="activity-label">${esc(item.label)}</div>
                ${item.detail ? `<div class="activity-detail">${esc(item.detail)}</div>` : ''}
              </div>
              <span class="activity-time">${relativeTime(item.at)}</span>
            </div>`
          )
          .join('');
      }

      async function renderRecommended() {
        try {
          catalog = OTZ.i18n.localizeCatalog(await api.tweaks.list());
          const list = (catalog.tweaks || []).filter((tweak) => tweak.recommended).slice(0, 5);
          recommendedCount = list.filter((tweak) => !tweak.applied).length;
          updateHeroNote();

          if (!list.length) {
            refs.recList.innerHTML = `<div class="empty">${icon('check')}<span>Tudo em ordem. Nao ha ajustes recomendados pendentes.</span></div>`;
            return;
          }

          refs.recList.innerHTML = list
            .map((tweak, index) => {
              const chips = [];
              if (tweak.applied) chips.push('<span class="chip success">ATIVO</span>');
              if (tweak.admin) chips.push('<span class="chip">ADMIN</span>');
              if (tweak.locked) chips.push('<span class="chip gold">BETA</span>');

              return `<article class="rec-row" style="--i:${index}">
                <span class="rec-icon">${icon(CATEGORY_ICON[tweak.category] || 'bolt')}</span>
                <div class="rec-body">
                  <div class="rec-title">${esc(tweak.name)} ${chips.join('')}</div>
                  <div class="rec-desc">${esc(tweak.desc)}</div>
                </div>
                <button class="switch" type="button" role="switch" aria-checked="${Boolean(tweak.applied)}"
                  data-toggle="${tweak.id}" aria-label="${esc(tweak.name)}"></button>
              </article>`;
            })
            .join('');
        } catch {
          refs.recList.innerHTML = `<div class="empty">${icon('alert')}<span>Nao foi possivel carregar os ajustes.</span></div>`;
        }
      }

      refs.recList.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-toggle]');
        if (!button || !catalog) return;

        const tweak = catalog.tweaks.find((item) => item.id === button.dataset.toggle);
        if (!tweak) return;

        if (!catalog.premium) {
          const go = await modal({
            iconName: 'lock',
            title: 'Ajuste bloqueado',
            text: 'O periodo de avaliacao terminou. Ativa uma licenca para continuares a aplicar tweaks.',
            confirmText: 'Ver licenca',
          });
          if (go) navigate('license');
          return;
        }

        if (tweak.locked) {
          const go = await modal({
            iconName: 'flask',
            title: 'Funcao Owner/Beta',
            text: 'Este ajuste faz parte do acesso experimental. Precisa de uma chave Owner ou Beta.',
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
            if (result.code === 'LICENSE' || result.code === 'BETA') navigate('license');
            return;
          }

          tweak.applied = next;
          button.setAttribute('aria-checked', String(next));
          pushActivity(next ? 'Tweak aplicado' : 'Tweak revertido', tweak.name);
          renderFeed();
          renderRecommended();
          toast({
            type: 'success',
            title: next ? 'Tweak aplicado' : 'Tweak revertido',
            text: result.restart ? 'Reinicia o PC para o efeito completo.' : tweak.name,
          });
        } catch (error) {
          toast({ type: 'error', title: 'Erro', text: String(error && error.message ? error.message : error) });
        } finally {
          button.removeAttribute('aria-busy');
        }
      });

      refs.refresh.addEventListener('click', async () => {
        OTZ.ui.busy(refs.refresh, true, 'A atualizar…');
        try {
          await Promise.all([loadStats(), renderRecommended()]);
          toast({ type: 'info', title: 'Dados atualizados' });
        } finally {
          OTZ.ui.busy(refs.refresh, false);
        }
      });

      /* -------------------------------------------------------------- */
      /* Otimizacao em um clique                                        */
      /* -------------------------------------------------------------- */

      function openOptimizer() {
        const optimizeRoot = document.getElementById('optimize-root');
        if (!optimizeRoot) return;

        const isAdmin = Boolean((state.info && state.info.isAdmin) || (lastStats && lastStats.isAdmin));
        const phases = [
          'A analisar o sistema',
          'A limpar ficheiros temporarios',
          'A aplicar tweaks recomendados',
          'A atualizar a rede',
          'A finalizar',
        ];

        optimizeRoot.innerHTML = `
          <div class="opt-overlay">
            <div class="opt-panel" role="dialog" aria-modal="true" aria-label="Otimizacao Nyx">
              <button class="opt-close" id="opt-close" type="button" aria-label="Fechar" hidden>${icon('x')}</button>

              <div class="opt-steps">
                <span class="opt-kicker">Nyx smart optimization</span>
                <h3 class="opt-title">A afinar o teu PC</h3>
                <div class="opt-step-list" id="opt-steps">
                  <div class="opt-step is-active" data-step="0">
                    <span class="opt-step-icon">01</span>
                    <div><b>Analisar o sistema</b><small>A ler CPU, memoria e disco</small></div>
                  </div>
                  <div class="opt-step" data-step="1">
                    <span class="opt-step-icon">02</span>
                    <div><b>Limpar temporarios</b><small>Caches seguras e ficheiros orfaos</small></div>
                  </div>
                  <div class="opt-step" data-step="2">
                    <span class="opt-step-icon">03</span>
                    <div><b>Aplicar tweaks</b><small>Apenas ajustes recomendados</small></div>
                  </div>
                  <div class="opt-step" data-step="3">
                    <span class="opt-step-icon">04</span>
                    <div><b>Otimizar a rede</b><small>Cache DNS e prioridade de rede</small></div>
                  </div>
                  <div class="opt-step" data-step="4">
                    <span class="opt-step-icon">05</span>
                    <div><b>Finalizar</b><small>A confirmar o resultado</small></div>
                  </div>
                </div>
              </div>

              <div class="opt-core">
                <div class="opt-orb">
                  <div class="opt-dots"></div>
                  <svg class="opt-ring" viewBox="0 0 200 200">
                    <circle class="track" cx="100" cy="100" r="94" pathLength="100" />
                    <circle class="value" id="opt-ring" cx="100" cy="100" r="94" pathLength="100" />
                  </svg>
                  <div class="opt-percent"><span id="opt-percent">0</span><small>%</small></div>
                </div>
                <div class="opt-phase" id="opt-phase">${phases[0]}</div>
              </div>

              <aside class="opt-side">
                <span class="opt-kicker">Seguranca</span>
                <div class="opt-safe">
                  ${icon('shield')}
                  <div><b>Tweaks reversiveis</b><p>Podes restaurar todos os ajustes na pagina Performance.</p></div>
                </div>
                <div class="opt-safe">
                  ${icon('lock')}
                  <div><b>Nada sai deste PC</b><p>Sem telemetria, sem envio de dados para servidores.</p></div>
                </div>
                <div class="opt-safe">
                  ${icon('cpu')}
                  <div><b>${isAdmin ? 'Administrador ativo' : 'Modo limitado'}</b><p>${
                    isAdmin
                      ? 'Todos os ajustes compativeis podem ser aplicados.'
                      : 'Ajustes que precisam de admin sao ignorados sem bloquear o resto.'
                  }</p></div>
                </div>

                <div class="opt-summary" id="opt-summary" hidden>
                  <div class="opt-summary-grid">
                    <div>
                      <div class="opt-summary-value" id="opt-freed">0 B</div>
                      <div class="opt-summary-label">Libertado</div>
                    </div>
                    <div>
                      <div class="opt-summary-value" id="opt-tweaks">0</div>
                      <div class="opt-summary-label">Tweaks aplicados</div>
                    </div>
                  </div>
                  <div class="opt-error" id="opt-error" hidden></div>
                  <div class="opt-actions">
                    <button class="btn btn-light btn-sm" id="opt-finish" type="button" hidden>Concluir</button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        `;

        const overlay = optimizeRoot.querySelector('.opt-overlay');
        const closeBtn = optimizeRoot.querySelector('#opt-close');
        const finishBtn = optimizeRoot.querySelector('#opt-finish');
        const summary = optimizeRoot.querySelector('#opt-summary');
        const errorEl = optimizeRoot.querySelector('#opt-error');
        const freedEl = optimizeRoot.querySelector('#opt-freed');
        const tweaksEl = optimizeRoot.querySelector('#opt-tweaks');
        const phaseEl = optimizeRoot.querySelector('#opt-phase');
        const percentEl = optimizeRoot.querySelector('#opt-percent');
        const ring = optimizeRoot.querySelector('#opt-ring');
        const stepNodes = [...optimizeRoot.querySelectorAll('.opt-step')];

        let current = 0;
        let progress = 0;
        let progressTimer = null;
        let stepTimer = null;
        let closed = false;

        function setProgress(value) {
          progress = Math.max(0, Math.min(100, Math.round(value)));
          percentEl.textContent = String(progress);
          ring.style.strokeDasharray = `${progress} 100`;
        }

        function setStep(index, status) {
          const node = stepNodes[index];
          if (!node) return;
          node.classList.remove('is-active', 'is-done', 'is-failed');
          if (status) node.classList.add(`is-${status}`);
        }

        function close() {
          if (closed) return;
          closed = true;
          clearInterval(progressTimer);
          clearInterval(stepTimer);
          document.removeEventListener('keydown', onKey);
          optimizeRoot.innerHTML = '';
          setStatus('Sistema pronto');
          refs.optimize.focus();
        }

        function onKey(event) {
          if (event.key === 'Escape' && !closeBtn.hidden) close();
        }

        document.addEventListener('keydown', onKey);
        closeBtn.addEventListener('click', close);
        finishBtn.addEventListener('click', close);

        setStatus('A otimizar o sistema', 'busy');
        setProgress(0);
        setStep(0, 'active');

        const started = performance.now();
        progressTimer = setInterval(() => {
          const t = Math.min(1, (performance.now() - started) / 6200);
          const eased = 1 - (1 - t) ** 3;
          setProgress(Math.min(92, eased * 92));
          if (t >= 1) clearInterval(progressTimer);
        }, 70);

        stepTimer = setInterval(() => {
          if (current >= 3) return;
          setStep(current, 'done');
          current += 1;
          setStep(current, 'active');
          phaseEl.textContent = phases[current];
        }, 950);

        (async () => {
          let result = null;
          let failure = null;

          try {
            const responses = await Promise.all([api.system.boost(), wait(2400)]);
            result = responses[0];
          } catch (error) {
            failure = error;
          }

          clearInterval(progressTimer);
          clearInterval(stepTimer);

          if (failure || !result || !result.ok) {
            setStep(current, 'failed');
            phaseEl.textContent = 'Otimizacao interrompida';
            setProgress(progress);
            summary.hidden = false;
            errorEl.hidden = false;
            errorEl.textContent =
              (result && result.message) ||
              (failure && failure.message) ||
              'Nao foi possivel concluir a otimizacao.';
            finishBtn.hidden = false;
            closeBtn.hidden = false;
            setStatus('Otimizacao interrompida');
            toast({
              type: 'error',
              title: 'Otimizacao nao concluida',
              text: errorEl.textContent,
            });
            return;
          }

          stepNodes.forEach((node) => {
            node.classList.remove('is-active', 'is-failed');
            node.classList.add('is-done');
          });
          phaseEl.textContent = 'Otimizacao concluida';
          setProgress(100);

          const details = [
            'Sistema analisado',
            (result.steps && result.steps[0] && result.steps[0].detail) || 'Ficheiros temporarios',
            (result.steps && result.steps[1] && result.steps[1].detail) || 'Tweaks recomendados',
            (result.steps && result.steps[2] && result.steps[2].detail) || 'Cache DNS',
            'Tudo em ordem',
          ];
          stepNodes.forEach((node, index) => {
            const small = node.querySelector('small');
            if (small) small.textContent = details[index];
          });

          freedEl.textContent = fmtBytes(result.freed || 0);
          tweaksEl.textContent = String(result.tweaksApplied || 0);
          summary.hidden = false;
          finishBtn.hidden = false;
          closeBtn.hidden = false;
          setStatus('Sistema pronto');

          pushActivity(
            'Otimizacao concluida',
            `${fmtBytes(result.freed || 0)} libertados · ${result.tweaksApplied || 0} tweaks`
          );
          renderFeed();
          toast({
            type: 'success',
            title: 'Sistema otimizado',
            text: `${fmtBytes(result.freed || 0)} libertados · ${result.tweaksApplied || 0} tweaks aplicados.`,
          });

          await Promise.all([loadStats(), renderRecommended()]);
        })();
      }

      refs.optimize.addEventListener('click', async () => {
        const confirmed = await modal({
          iconName: 'bolt',
          title: 'Otimizar o teu PC?',
          text: 'Vamos limpar caches seguras, aplicar os tweaks recomendados e atualizar a cache DNS. Podes reverter tudo depois.',
          confirmText: 'Comecar',
        });
        if (!confirmed) return;
        openOptimizer();
      });

      renderFeed();
      await Promise.all([loadStats(), renderRecommended()]);
      timer = setInterval(loadStats, 3200);

      return () => clearInterval(timer);
    },
  };
})();
