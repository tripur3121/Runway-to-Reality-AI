import { api } from './api.js';

const HEIGHT_SCALE = { maya: 0.82, liam: 1.15, sophie: 1.0 };
const MEMBER_COLOR = { maya: '#e6879f', liam: '#5b84b1', sophie: '#d99a4e' };

let lastResult = null;
let activeMember = 'maya';

function renderOutfitPieces(outfit) {
  const wrap = document.getElementById('outfit-pieces');
  wrap.innerHTML = '';
  for (const item of outfit) {
    const row = document.createElement('div');
    row.className = 'outfit-piece';
    row.innerHTML = `
      <div class="swatch" style="background:${MEMBER_COLOR[item.ownerId] || '#ccc'}"></div>
      <div>
        <b>${item.name}</b>
        <span>${item.fabric} · ${item.brand} · from ${item.ownerId}'s closet</span>
      </div>
    `;
    wrap.appendChild(row);
  }
}

function applyPerspective(memberId) {
  activeMember = memberId;
  document.querySelectorAll('#perspective-switch .chip').forEach((c) => c.classList.toggle('active', c.dataset.member === memberId));
  if (!lastResult) return;
  const figure = document.getElementById('runway-figure');
  const scale = HEIGHT_SCALE[memberId] || 1;
  figure.style.height = `${120 * scale}px`;
  figure.style.background = `linear-gradient(180deg, ${MEMBER_COLOR[memberId]}, ${MEMBER_COLOR[memberId]}aa)`;
  document.getElementById('styling-tip').textContent = `💡 ${lastResult.tips[memberId].text}`;
  document.getElementById('veo-prompt').value = lastResult.veoPrompts[memberId];
}

export function initLookbook() {
  document.getElementById('curate-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Curating…';
    try {
      const result = await api.curateLookbook();
      applyLookbookResult(result);
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Curate My Outfit';
    }
  });

  document.getElementById('perspective-switch').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) applyPerspective(chip.dataset.member);
  });

  document.getElementById('watch-video-btn').addEventListener('click', () => {
    document.getElementById('runway-stage').classList.toggle('hidden');
  });

  document.getElementById('copy-veo-btn').addEventListener('click', async () => {
    const ta = document.getElementById('veo-prompt');
    ta.select();
    try {
      await navigator.clipboard.writeText(ta.value);
    } catch {
      document.execCommand('copy');
    }
  });
}

export function applyLookbookResult(result) {
  lastResult = result;
  document.getElementById('lookbook-empty').classList.add('hidden');
  document.getElementById('lookbook-content').classList.remove('hidden');
  renderOutfitPieces(result.outfit);
  applyPerspective(activeMember);
}
