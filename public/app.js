import { api, subscribeEvents } from './modules/api.js';
import { initCloset, setClosetState, updateItem } from './modules/closet.js';
import { initLookbook, applyLookbookResult } from './modules/lookbook.js';
import { initSquadSync } from './modules/squadsync.js';
import { initRoulette } from './modules/roulette.js';
import { initInspo } from './modules/inspo.js';
import { initAgents } from './modules/agents.js';
import { initFittingRoom, onModalClosed, handleServerEvent } from './modules/fitroom.js';
import { toast } from './modules/toast.js';

function initTabs() {
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === btn));
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${btn.dataset.tab}`));
  });
}

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  if (id === 'fitting-room-modal') onModalClosed();
}

function initModals() {
  document.getElementById('fitting-room-btn').addEventListener('click', () => openModal('fitting-room-modal'));
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
}

async function nudgeItem(itemId) {
  try {
    const result = await api.nudge(itemId);
    document.getElementById('nudge-text').textContent = result.text;
    document.getElementById('nudge-source').textContent =
      result.source === 'gemini' ? 'Drafted live by Gemini' : 'Drafted by the Nudge Agent (offline template — set GEMINI_API_KEY for live drafts)';
    openModal('nudge-modal');
  } catch (err) {
    toast(err.message);
  }
}

async function boot() {
  initTabs();
  initModals();
  initCloset({ onNudge: nudgeItem });
  initLookbook();
  initSquadSync();
  initRoulette();
  initInspo();
  initFittingRoom();
  initAgents();

  const state = await api.getState();
  setClosetState(state);

  subscribeEvents((type, payload) => {
    if (type === 'item-updated') updateItem(payload.item);
    else if (type === 'lookbook-curated') applyLookbookResult(payload);
    else handleServerEvent(type, payload);
  });
}

boot();
