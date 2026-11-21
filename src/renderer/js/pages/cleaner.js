'use strict';

(function () {
  const OTZ = window.OTZ;
  OTZ.pages = OTZ.pages || {};
  const { icon, esc, fmtBytes, toast, modal } = OTZ.ui;

  OTZ.pages.cleaner = {
    title: 'Cleanup',
    sub: 'Caches, temporarios e ficheiros orfaos',

    async render(root, ctx) {
      const { api, navigate, pushActivity } = ctx;

      root.innerHTML = `
        <div class="page-head">
          <div>
            <span class="eyebrow">Cleanup</span>
            <h2 class="page-title">Espaco sem peso.</h2>
            <p class="page-sub">Caches, temporarios e ficheiros que ja nao servem. Nada e apagado sem confirmares.</p>
          </div>
          <span class="chip" id="clean-chip">A ANALISAR</span>
        </div>

        <div class="clean-grid">
          <section class="clean-hero">
            <div class="clean-orb" id="orb">
              <div class="clean-orb-core">
                ${icon('broom')}
                <span id="orb-label">A analisar</span>
              </div>
            </div>
            <span class="eyebrow">Espaco recuperavel</span>
            <div class="clean-total" id="total">—</div>
            <div class="clean-sub" id="sub">A procurar ficheiros…</div>
            <button class="btn btn-light btn-block" id="clean" type="button" disabled>${icon('trash')} Limpar selecionados</button>
            <button class="btn btn-on-dark btn-block" id="scan" type="button" style="margin-top:7px">${icon('refresh')} Analisar novamente</button>
            <p class="clean-note">Ficheiros em uso pelo sistema sao ignorados automaticamente.</p>
          </section>

          <section class="card clean-list-card">
            <div class="clean-list-head">
              <div>
                <span class="eyebrow">Categorias</span>
                <div class="dns-title" style="margin-top:6px">O que queres limpar</div>
              </div>
              <button class="btn btn-ghost btn-sm" id="toggle-all" type="button">Selecionar tudo</button>
            </div>
            <div class="targets" id="targets">
              <div class="skeleton" style="height:52px;margin:6px 10px"></div>
              <div class="skeleton" style="height:52px;margin:6px 10px"></div>
              <div class="skeleton" style="height:52px;margin:6px 10px"></div>
              <div class="skeleton" style="height:52px;margin:6px 10px"></div>
            </div>
          </section>
        </div>
      `;

      const refs = {
        orb: root.querySelector('#orb'),
        orbLabel: root.querySelector('#orb-label'),
        total: root.querySelector('#total'),
        sub: root.querySelector('#sub'),
        clean: root.querySelector('#clean'),
        scan: root.querySelector('#scan'),
        toggleAll: root.querySelector('#toggle-all'),
        targets: root.querySelector('#targets'),
        chip: root.querySelector('#clean-chip'),
      };

      let targets = [];
      let scanning = false;

      function selectedTargets() {
        return targets.filter((target) => target.selected && !target.locked).map((target) => target.id);
      }

      function totalBytes() {
        return targets
          .filter((target) => target.selected && !target.locked)
          .reduce((sum, target) => sum + (target.bytes || 0), 0);
      }

      function paintTotal() {
        const bytes = totalBytes();
        const files = targets.reduce(
          (sum, target) => sum + (target.selected && !target.locked ? target.files || 0 : 0),
          0
        );

        refs.total.textContent = fmtBytes(bytes);
        refs.sub.textContent = bytes > 0
          ? `${files.toLocaleString(OTZ.i18n.lang === 'en' ? 'en-US' : 'pt-PT')} ficheiros selecionados`
          : 'Nada para limpar por agora';
        refs.clean.disabled = bytes <= 0 || scanning;
        refs.clean.innerHTML = bytes > 0
          ? `${icon('trash')} Limpar ${fmtBytes(bytes)}`
          : `${icon('trash')} Limpar selecionados`;
        refs.chip.textContent = `${targets.length} CATEGORIAS`;
        refs.chip.className = 'chip';
      }

      function row(target, index) {
        const chips = [];
        if (target.premium) chips.push(`<span class="chip gold">${icon('lock')} PRO</span>`);
        if (target.admin) chips.push('<span class="chip">ADMIN</span>');

        return `<div class="target ${target.selected && !target.locked ? 'is-selected' : ''} ${
          target.locked ? 'is-locked' : ''
        }" style="--i:${index}" role="checkbox" tabindex="0" aria-checked="${Boolean(target.selected && !target.locked)}" data-id="${target.id}">
          <span class="target-check" aria-hidden="true">${icon('check')}</span>
          <div class="target-body">
            <div class="target-name">${esc(target.name)} ${chips.join('')}</div>
            <div class="target-desc">${esc(target.desc)}</div>
          </div>
          <span class="target-size">${fmtBytes(target.bytes)}</span>
        </div>`;
      }

      function paint() {
        refs.targets.innerHTML = targets.map((target, index) => row(target, index)).join('');
        paintTotal();
      }

      async function scan() {
        if (scanning) return;
        scanning = true;
        refs.orb.classList.add('scanning');
        refs.orbLabel.textContent = 'A analisar';
        refs.total.textContent = '—';
        refs.sub.textContent = 'A procurar ficheiros…';
        refs.clean.disabled = true;
        refs.scan.disabled = true;
        refs.chip.textContent = 'A ANALISAR';
        refs.chip.className = 'chip warn';
        refs.targets.innerHTML = Array.from({ length: 6 })
          .map(() => '<div class="skeleton" style="height:52px;margin:6px 10px"></div>')
          .join('');

        try {
          const result = await api.cleaner.scan();
          const previous = new Map(targets.map((target) => [target.id, target.selected]));
          targets = OTZ.i18n.localizeTargets(result.targets || []).map((target) => ({
            ...target,
            selected: previous.has(target.id) ? previous.get(target.id) : !target.locked,
          }));
          refs.orbLabel.textContent = 'Pronto';
          paint();
          refs.chip.textContent = 'PRONTO';
          refs.chip.className = 'chip success';
        } catch (error) {
          refs.targets.innerHTML = `<div class="empty" style="border:0">${icon('alert')}<span>Nao foi possivel analisar agora.</span></div>`;
          toast({
            type: 'error',
            title: 'Falha na analise',
            text: String(error && error.message ? error.message : error),
          });
        } finally {
          scanning = false;
          refs.orb.classList.remove('scanning');
          refs.scan.disabled = false;
          refs.clean.disabled = totalBytes() <= 0;
        }
      }

      function toggleTarget(node) {
        const target = targets.find((item) => item.id === node.dataset.id);
        if (!target) return;

        if (target.locked) {
          modal({
            iconName: 'lock',
            title: 'Categoria Pro',
            text: 'As caches avancadas fazem parte do Nyx Pro. Ativa uma licenca para as limpar.',
            confirmText: 'Ver licenca',
          }).then((go) => {
            if (go) navigate('license');
          });
          return;
        }

        target.selected = !target.selected;
        node.classList.toggle('is-selected', target.selected);
        node.setAttribute('aria-checked', String(target.selected));
        paintTotal();
      }

      refs.targets.addEventListener('click', (event) => {
        const node = event.target.closest('.target');
        if (node) toggleTarget(node);
      });

      refs.targets.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const node = event.target.closest('.target');
        if (!node) return;
        event.preventDefault();
        toggleTarget(node);
      });

      refs.toggleAll.addEventListener('click', () => {
        const unlocked = targets.filter((target) => !target.locked);
        const allSelected = unlocked.every((target) => target.selected);
        unlocked.forEach((target) => {
          target.selected = !allSelected;
        });
        paint();
      });

      refs.scan.addEventListener('click', scan);

      refs.clean.addEventListener('click', async () => {
        const ids = selectedTargets();
        if (!ids.length) return;
        const bytes = totalBytes();

        const confirmed = await modal({
          iconName: 'trash',
          title: `Limpar ${fmtBytes(bytes)}?`,
          text: 'Vamos remover temporarios, caches e o conteudo da reciclagem. Ficheiros em uso sao ignorados.',
          confirmText: 'Limpar agora',
        });
        if (!confirmed) return;

        OTZ.ui.busy(refs.clean, true, 'A limpar…');
        try {
          const result = await api.cleaner.clean(ids);
          if (!result.ok) {
            toast({ type: 'error', title: 'Limpeza bloqueada', text: result.message });
            if (result.code === 'LICENSE') navigate('license');
            return;
          }

          toast({
            type: 'success',
            title: 'Limpeza concluida',
            text: `${fmtBytes(result.freed)} libertados · ${Number(result.removedFiles || 0).toLocaleString(OTZ.i18n.lang === 'en' ? 'en-US' : 'pt-PT')} ficheiros.`,
          });
          pushActivity('Limpeza concluida', `${fmtBytes(result.freed)} libertados`);
        } catch (error) {
          toast({
            type: 'error',
            title: 'Falha na limpeza',
            text: String(error && error.message ? error.message : error),
          });
        } finally {
          OTZ.ui.busy(refs.clean, false);
        }

        await scan();
      });

      await scan();
    },
  };
})();
