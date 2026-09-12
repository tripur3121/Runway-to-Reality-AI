import { api } from './api.js';
import { toast } from './toast.js';

const CATEGORY_EMOJI = {
  outerwear: '🧥',
  top: '👕',
  bottom: '👖',
  dress: '👗',
  shoes: '👞',
};

let currentFilter = 'all';
let state = { members: [], items: [] };
let onNudge = () => {};

function memberColor(id) {
  const m = state.members.find((mm) => mm.id === id);
  return m ? m.color : '#999';
}
function memberName(id) {
  const m = state.members.find((mm) => mm.id === id);
  return m ? m.name : id;
}

function itemCard(item) {
  const taken = Boolean(item.claimedBy);
  const div = document.createElement('div');
  div.className = `item-card${taken ? ' taken' : ''}`;
  div.dataset.itemId = item.id;

  const photo = document.createElement('div');
  photo.className = 'item-photo';
  photo.style.background = `linear-gradient(135deg, ${memberColor(item.ownerId)}55, ${memberColor(item.ownerId)}22)`;
  photo.textContent = CATEGORY_EMOJI[item.category] || '🧦';

  const ownerTag = document.createElement('span');
  ownerTag.className = 'owner-tag';
  ownerTag.style.background = memberColor(item.ownerId);
  ownerTag.textContent = memberName(item.ownerId);
  photo.appendChild(ownerTag);

  const laundryBtn = document.createElement('button');
  laundryBtn.className = `laundry-toggle ${item.laundry}`;
  laundryBtn.textContent = item.laundry === 'fresh' ? '✓ Fresh' : '⏳ In Hamper';
  laundryBtn.addEventListener('click', async () => {
    const next = item.laundry === 'fresh' ? 'hamper' : 'fresh';
    await api.setLaundry(item.id, next);
  });
  photo.appendChild(laundryBtn);

  if (taken) {
    const banner = document.createElement('div');
    banner.className = 'taken-banner';
    banner.textContent = `TAKEN BY ${memberName(item.claimedBy).toUpperCase()}`;
    photo.appendChild(banner);
  }

  div.appendChild(photo);

  const body = document.createElement('div');
  body.className = 'item-body';
  body.innerHTML = `
    <h4>${item.name}</h4>
    <span class="item-spec">Size ${item.size} · ${item.fabric}</span>
    <span class="item-spec">${item.brand}</span>
  `;

  const actions = document.createElement('div');
  actions.className = 'item-actions';

  if (taken) {
    const nudgeBtn = document.createElement('button');
    nudgeBtn.className = 'btn btn-primary';
    nudgeBtn.textContent = 'Nudge';
    nudgeBtn.addEventListener('click', () => onNudge(item.id));
    actions.appendChild(nudgeBtn);

    const releaseBtn = document.createElement('button');
    releaseBtn.className = 'btn btn-ghost';
    releaseBtn.textContent = 'Return it';
    releaseBtn.addEventListener('click', async () => {
      await api.releaseItem(item.id);
      toast(`${item.name} returned to ${memberName(item.ownerId)}'s closet`);
    });
    actions.appendChild(releaseBtn);
  } else if (item.pool) {
    const claimBtn = document.createElement('select');
    claimBtn.className = 'btn btn-ghost';
    claimBtn.innerHTML = `<option value="">Claim as…</option>` + state.members
      .filter((m) => m.id !== item.ownerId)
      .map((m) => `<option value="${m.id}">${m.name}</option>`)
      .join('');
    claimBtn.addEventListener('change', async () => {
      if (!claimBtn.value) return;
      await api.claimItem(item.id, claimBtn.value);
      toast(`${memberName(claimBtn.value)} claimed the ${item.name}`);
    });
    actions.appendChild(claimBtn);
  } else {
    const note = document.createElement('span');
    note.className = 'item-spec';
    note.textContent = 'Not in shared pool';
    actions.appendChild(note);
  }

  body.appendChild(actions);
  div.appendChild(body);
  return div;
}

export function initCloset({ onNudge: nudgeHandler }) {
  onNudge = nudgeHandler;
  document.getElementById('member-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    currentFilter = btn.dataset.member;
    document.querySelectorAll('#member-filter .chip').forEach((c) => c.classList.toggle('active', c === btn));
    render();
  });
}

export function setClosetState(newState) {
  state = newState;
  render();
}

export function updateItem(item) {
  const idx = state.items.findIndex((i) => i.id === item.id);
  if (idx >= 0) state.items[idx] = item;
  render();
}

function render() {
  const grid = document.getElementById('closet-grid');
  grid.innerHTML = '';
  const visible = currentFilter === 'all' ? state.items.filter((i) => i.pool) : state.items.filter((i) => i.ownerId === currentFilter);
  for (const item of visible) {
    grid.appendChild(itemCard(item));
  }
  if (!visible.length) {
    grid.innerHTML = '<p class="muted">Nothing here yet.</p>';
  }
}
