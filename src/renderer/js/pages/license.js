'use strict';

(function () {
  const OTZ = window.OTZ;
  OTZ.pages = OTZ.pages || {};
  const { icon, esc, toast, modal } = OTZ.ui;

  OTZ.pages.license = {
    title: 'Licenca',
    sub: 'Ativa ou gere o teu acesso Nyx',

    async render(root, ctx) {
      const { api, state, refreshLicense, navigate } = ctx;
      const license = (await refreshLicense()) || state.license;

      if (!license) {
        root.innerHTML = `<div class="empty">${icon('alert')}<span>Nao foi possivel ler o estado da licenca.</span></div>`;
        return;
      }

      const trial = license.trial || {};
      const percent = license.licensed
        ? license.perpetual
          ? 100
          : Math.max(4, Math.round(((license.daysLeft || 0) / (license.durationDays || 365)) * 100))
        : Math.max(0, Math.round(((trial.daysLeft || 0) / (trial.totalDays || 7)) * 100));

      const expiryLabel = license.perpetual
        ? 'Chave permanente.'
        : license.expiresAt
          ? `Valida ate ${license.expiresAt.slice(0, 10)} (${license.daysLeft} dias).`
          : '';

      const title = license.licensed
        ? `Nyx ${license.planLabel}`
        : license.betaAccess
          ? 'Acesso beta ativo'
          : license.expired
            ? 'Licenca expirada'
            : trial.active
              ? 'Avaliacao Nyx'
              : 'Avaliacao terminada';

      const description = license.licensed
        ? `Todos os tweaks e limpezas avancadas estao desbloqueados neste PC. ${expiryLabel}`
        : license.betaAccess
          ? 'O acesso experimental esta ativo neste PC. Mantem o teu acesso para continuares a receber funcoes novas.'
          : trial.active && !license.expired
            ? `Tens acesso completo a tudo durante mais ${trial.daysLeft} ${
                trial.daysLeft === 1 ? 'dia' : 'dias'
              }. Ativa uma chave para continuares depois disso.`
            : license.expired
              ? `A chave ${license.expired.planLabel} expirou em ${license.expired.expiresAt.slice(0, 10)}. Ativa uma chave nova para voltares a aplicar tweaks.`
              : 'O periodo de avaliacao terminou. Ativa uma chave para voltares a aplicar tweaks e limpar caches avancadas.';

      const badges = [];
      if (license.licensed) badges.push(`<span class="chip">${esc(license.planLabel || 'PRO')}</span>`);
      if (license.singleUse) badges.push('<span class="chip">1 USO</span>');
      if (license.betaAccess) badges.push('<span class="chip">EXPERIMENTAL</span>');
      if (trial.active && !license.licensed) badges.push('<span class="chip">TRIAL</span>');
      if (license.expired) badges.push('<span class="chip">EXPIRADA</span>');

      root.innerHTML = `
        <div class="page-head">
          <div>
            <span class="eyebrow">Nyx membership</span>
            <h2 class="page-title">A tua licenca.</h2>
            <p class="page-sub">Ativacao local. A chave nunca sai deste computador.</p>
          </div>
          <span class="chip">LOCAL</span>
        </div>

        <div class="license-grid">
          <section class="license-status">
            <span class="eyebrow">Estado atual</span>
            <h2>${esc(title)}</h2>
            <p>${esc(description)}</p>
            <div class="license-badges">${badges.join('')}</div>
            <div class="license-bar"><i style="--p:${percent}%"></i></div>
            <div class="license-meta">
              <span>${license.licensed ? `CHAVE ${esc(license.key || '')}` : `${trial.daysLeft || 0} DE ${trial.totalDays || 7} DIAS`}</span>
              <span>ID ${esc(license.machineId || '—')}</span>
            </div>
          </section>

          <section class="card pad license-activate">
            <span class="eyebrow">Ativar chave</span>
            <h2>Introduz a tua chave</h2>
            <p>Cola a chave para desbloquear todos os tweaks e as caches avancadas.</p>
            <div class="key-row">
              <label class="field">
                ${icon('key')}
                <input id="key" type="text" placeholder="OTZ-OWNER-XXXX-XXXX-XXXX" maxlength="28"
                  spellcheck="false" autocomplete="off" />
              </label>
              <button class="btn btn-primary" id="activate" type="button">Ativar</button>
            </div>
            <div class="key-hint" id="key-hint">Validacao offline — a chave fica apenas neste PC.</div>
            ${
              license.licensed
                ? '<button class="btn btn-ghost btn-sm" id="deactivate" type="button" style="margin-top:10px;align-self:flex-start">Desativar licenca deste PC</button>'
                : ''
            }
          </section>
        </div>

        <div class="license-perks">
          <div class="perk">
            ${icon('sliders')}
            <b>Todos os tweaks</b>
            <span>Ajustes reais de desempenho, gaming e privacidade.</span>
          </div>
          <div class="perk">
            ${icon('broom')}
            <b>Limpeza profunda</b>
            <span>Caches avancadas e ficheiros que o Windows esquece.</span>
          </div>
          <div class="perk">
            ${icon('shield')}
            <b>Sem telemetria</b>
            <span>Tudo local. Nenhum dado sai deste computador.</span>
          </div>
        </div>
      `;

      const keyInput = root.querySelector('#key');
      const hint = root.querySelector('#key-hint');
      const activateBtn = root.querySelector('#activate');

      function setHint(message, tone) {
        hint.textContent = message;
        hint.className = `key-hint${tone ? ` ${tone}` : ''}`;
      }

      keyInput.addEventListener('input', () => {
        keyInput.value = keyInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      });

      keyInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') activateBtn.click();
      });

      activateBtn.addEventListener('click', async () => {
        const value = keyInput.value.trim();
        if (!value) {
          setHint('Introduz a tua chave primeiro.', 'err');
          keyInput.focus();
          return;
        }

        OTZ.ui.busy(activateBtn, true, 'A validar…');
        try {
          const result = await api.license.activate(value);
          if (!result.ok) {
            setHint(result.message, 'err');
            toast({ type: 'error', title: 'Chave recusada', text: result.message });
            return;
          }

          setHint('Licenca ativada com sucesso.', 'ok');
          toast({ type: 'success', title: 'Licenca ativada', text: result.message });
          await refreshLicense();
          navigate('license');
        } catch (error) {
          setHint(String(error && error.message ? error.message : error), 'err');
        } finally {
          OTZ.ui.busy(activateBtn, false);
        }
      });

      root.querySelector('#deactivate')?.addEventListener('click', async () => {
        const confirmed = await modal({
          iconName: 'alert',
          title: 'Desativar licenca?',
          text: 'A app volta ao modo de avaliacao neste PC. Podes reativar com a mesma chave.',
          confirmText: 'Desativar',
          tone: 'danger',
        });
        if (!confirmed) return;

        await api.license.deactivate();
        await refreshLicense();
        toast({ type: 'info', title: 'Licenca removida deste PC' });
        navigate('license');
      });
    },
  };
})();
