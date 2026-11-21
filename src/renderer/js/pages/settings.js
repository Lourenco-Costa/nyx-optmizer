'use strict';

(function () {
  const OTZ = window.OTZ;
  OTZ.pages = OTZ.pages || {};
  const { icon, esc, toast, modal } = OTZ.ui;

  OTZ.pages.settings = {
    title: 'Definicoes',
    sub: 'Permissoes, seguranca e sobre a app',

    async render(root, ctx) {
      const { api, state, navigate, refreshLicense } = ctx;
      const info = state.info || (await api.app.info());
      const license = (await refreshLicense()) || state.license;
      const updaterState = api.updater && api.updater.status
        ? await api.updater.status().catch(() => null)
        : null;

      const licenseLabel = !license
        ? 'Estado indisponivel'
        : license.licensed
          ? `Plano ${license.planLabel} ativo`
          : license.betaAccess
            ? 'Acesso beta ativo'
            : license.trial && license.trial.active
              ? `Avaliacao — ${license.trial.daysLeft} dias restantes`
              : 'Avaliacao terminada';

      root.innerHTML = `
        <div class="page-head">
          <div>
            <span class="eyebrow">Definicoes</span>
            <h2 class="page-title">Controlo total.</h2>
            <p class="page-sub">Permissoes, seguranca e os detalhes tecnicos do Nyx.</p>
          </div>
          <span class="chip">${info.isAdmin ? 'ADMIN' : 'LIMITADO'}</span>
        </div>

        <div class="settings-grid">
          <section class="card settings-card">
            <div class="settings-head">
              <span class="eyebrow">Sistema</span>
            </div>
            <div class="settings-list">
              <div class="setting-row">
                <span class="icon-box">${icon('shield')}</span>
                <div class="setting-body">
                  <div class="setting-title">Permissoes</div>
                  <div class="setting-desc" id="admin-state">${
                    info.isAdmin
                      ? 'Com privilegios de administrador'
                      : 'Sem privilegios — ajustes de sistema bloqueados'
                  }</div>
                </div>
                <button class="btn btn-sm setting-action" id="elevate" type="button" ${
                  info.isAdmin ? 'aria-disabled="true"' : ''
                }>${info.isAdmin ? 'Admin ativo' : 'Reiniciar como admin'}</button>
              </div>

              <div class="setting-row">
                <span class="icon-box">${icon('refresh')}</span>
                <div class="setting-body">
                  <div class="setting-title">Ponto de restauro</div>
                  <div class="setting-desc">Cria um ponto antes de aplicar alteracoes (requer admin)</div>
                </div>
                <button class="btn btn-sm setting-action" id="restore-point" type="button">Criar</button>
              </div>

              <div class="setting-row">
                <span class="icon-box">${icon('sliders')}</span>
                <div class="setting-body">
                  <div class="setting-title">Restaurar tweaks</div>
                  <div class="setting-desc">Devolve o Windows ao estado original</div>
                </div>
                <button class="btn btn-sm setting-action" id="reset-tweaks" type="button">Restaurar</button>
              </div>

              <div class="setting-row">
                <span class="icon-box">${icon('wifi')}</span>
                <div class="setting-body">
                  <div class="setting-title">Cache DNS</div>
                  <div class="setting-desc">Limpa resolucoes antigas de nomes</div>
                </div>
                <button class="btn btn-sm setting-action" id="dns" type="button">Limpar</button>
              </div>

              <div class="setting-row">
                <span class="icon-box">${icon('folder')}</span>
                <div class="setting-body">
                  <div class="setting-title">Pasta de dados</div>
                  <div class="setting-desc">Licenca e configuracoes locais</div>
                </div>
                <button class="btn btn-sm setting-action" id="open-data" type="button">Abrir</button>
              </div>

              <div class="setting-row">
                <span class="icon-box">${icon('crown')}</span>
                <div class="setting-body">
                  <div class="setting-title">Licenca</div>
                  <div class="setting-desc">${esc(licenseLabel)}</div>
                </div>
                <button class="btn btn-sm setting-action" id="go-license" type="button">Gerir</button>
              </div>

              <div class="setting-row">
                <span class="icon-box">${icon('refresh')}</span>
                <div class="setting-body">
                  <div class="setting-title">Atualizacoes</div>
                  <div class="setting-desc" id="updater-state">A preparar o canal...</div>
                  <div class="updater-progress" id="updater-progress" hidden><span id="updater-bar"></span></div>
                </div>
                <button class="btn btn-sm setting-action" id="updater-check" type="button">Verificar</button>
              </div>
            </div>
          </section>

          <aside class="about-card">
            <div class="about-logo">
              <img src="../../assets/icon-256.png" alt="Nyx Optmizer" width="42" height="42" />
            </div>
            <div class="about-name">Nyx Optmizer</div>
            <p class="about-copy">Otimizacao real para Windows. Preto no branco, sem atalhos.</p>
            <div class="about-meta">
              <div class="about-row"><span>Versao</span><span>${esc(info.version || '1.0.0')}</span></div>
              <div class="about-row"><span>Electron</span><span>${esc(info.electron || '—')}</span></div>
              <div class="about-row"><span>Chromium</span><span>${esc(info.chrome || '—')}</span></div>
              <div class="about-row"><span>Maquina</span><span>${esc((license && license.machineId) || '—')}</span></div>
              <div class="about-row"><span>Autor</span><span>sensei_officialyt</span></div>
            </div>
          </aside>
        </div>
      `;

      root.querySelector('#elevate').addEventListener('click', async () => {
        if (info.isAdmin) return;
        const ok = await api.system.relaunchElevated();
        if (!ok) {
          toast({
            type: 'info',
            title: 'Reinicio cancelado',
            text: 'A app fecha e abre novamente com o pedido de administrador.',
          });
        }
      });

      root.querySelector('#restore-point').addEventListener('click', async () => {
        const button = root.querySelector('#restore-point');
        OTZ.ui.busy(button, true, 'A criar…');
        try {
          const result = await api.system.createRestorePoint();
          toast({
            type: result.ok ? 'success' : 'warn',
            title: result.ok ? 'Ponto de restauro criado' : 'Nao criado',
            text: result.message,
          });
        } finally {
          OTZ.ui.busy(button, false);
        }
      });

      root.querySelector('#reset-tweaks').addEventListener('click', async () => {
        const confirmed = await modal({
          iconName: 'refresh',
          title: 'Restaurar tweaks?',
          text: 'Todos os ajustes aplicados voltam ao estado original do Windows.',
          confirmText: 'Restaurar',
          tone: 'danger',
        });
        if (!confirmed) return;

        const result = await api.tweaks.restoreDefaults();
        toast({
          type: result.ok ? 'success' : 'error',
          title: result.ok ? 'Predefinicoes restauradas' : 'Falhou',
          text: result.message,
        });
      });

      root.querySelector('#dns').addEventListener('click', async () => {
        const result = await api.system.flushDns();
        toast({
          type: result.ok ? 'success' : 'error',
          title: result.ok ? 'Cache DNS limpa' : 'Falhou',
          text: result.message || '',
        });
      });

      root.querySelector('#open-data').addEventListener('click', async () => {
        const ok = await api.app.openPath('data');
        if (!ok) {
          toast({
            type: 'info',
            title: 'Pasta de dados',
            text: (license && license.storePath) || 'Disponivel na app instalada.',
          });
        }
      });

      root.querySelector('#go-license').addEventListener('click', async () => {
        await refreshLicense();
        navigate('license');
      });

      const updaterText = root.querySelector('#updater-state');
      const updaterButton = root.querySelector('#updater-check');
      const updaterProgress = root.querySelector('#updater-progress');
      const updaterBar = root.querySelector('#updater-bar');

      function paintUpdater(status) {
        if (!status) {
          updaterText.textContent = 'Modulo de atualizacoes indisponivel.';
          updaterButton.disabled = true;
          return;
        }

        const messages = {
          idle: 'Ainda nao verificou atualizacoes.',
          dev: 'Indisponivel em modo de desenvolvimento.',
          unconfigured: 'Canal GitHub por configurar.',
          disabled: 'Canal de atualizacoes desativado.',
          checking: 'A procurar uma versao nova...',
          current: 'Estas na versao mais recente.',
          ready: `Versao ${status.updateVersion || ''} pronta a instalar.`,
          error: status.message || 'Nao foi possivel verificar.',
        };

        updaterText.textContent = status.message || messages[status.status] || messages.idle;
        updaterButton.textContent = status.status === 'ready' ? 'Instalar' : 'Verificar';
        updaterButton.disabled = status.status === 'ready' ? false : !status.canCheck;
        updaterProgress.hidden = status.status !== 'downloading';
        if (updaterBar) updaterBar.style.width = `${Math.max(0, Math.min(100, status.progress || 0))}%`;
      }

      paintUpdater(updaterState);

      const stopUpdater = api.updater && api.updater.onEvent
        ? api.updater.onEvent(paintUpdater)
        : null;

      updaterButton.addEventListener('click', async () => {
        if (!api.updater) return;

        if (updaterButton.textContent === 'Instalar') {
          const installing = api.updater.install();
          if (!installing) {
            toast({ type: 'info', title: 'Atualizacao', text: 'A atualizacao ainda nao esta pronta.' });
          }
          return;
        }

        updaterButton.disabled = true;
        try {
          const status = await api.updater.check();
          paintUpdater(status);
          if (status && status.status === 'error') {
            toast({ type: 'info', title: 'Atualizacoes', text: status.message });
          }
        } catch (error) {
          toast({
            type: 'error',
            title: 'Atualizacoes',
            text: String(error && error.message ? error.message : error),
          });
        } finally {
          updaterButton.disabled = false;
        }
      });

      return () => {
        if (typeof stopUpdater === 'function') stopUpdater();
      };
    },
  };
})();
