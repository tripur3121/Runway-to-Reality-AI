import { api } from './api.js';

let activeHandle = null;

export function initInspo() {
  document.getElementById('inspo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('inspo-handle');
    const handle = input.value.trim();
    if (!handle) return;
    input.value = '';
    const { influencers } = await api.addInfluencer(handle);
    renderHandles(influencers);
    selectHandle(influencers[influencers.length - 1]);
  });

  api.getInfluencers().then(({ influencers }) => {
    renderHandles(influencers);
    if (influencers.length) selectHandle(influencers[0]);
  });
}

function renderHandles(list) {
  const wrap = document.getElementById('inspo-handles');
  wrap.innerHTML = '';
  for (const handle of list) {
    const chip = document.createElement('button');
    chip.className = `chip${handle === activeHandle ? ' active' : ''}`;
    chip.textContent = `@${handle}`;
    chip.addEventListener('click', () => selectHandle(handle));
    wrap.appendChild(chip);
  }
}

async function selectHandle(handle) {
  activeHandle = handle;
  document.querySelectorAll('#inspo-handles .chip').forEach((c) => c.classList.toggle('active', c.textContent === `@${handle}`));
  const grid = document.getElementById('inspo-grid');
  grid.innerHTML = '<p class="muted">Loading recent posts…</p>';
  const result = await api.getInspo(handle);
  grid.innerHTML = '';
  if (!result.posts.length) {
    grid.innerHTML = '<p class="muted">No posts from the last 3 months.</p>';
    return;
  }
  const note = document.createElement('p');
  note.className = 'muted small';
  note.style.gridColumn = '1 / -1';
  note.textContent = `${result.withinThreeMonths} of ${result.totalFetched} posts fall within the last 3 months (source: ${result.source === 'live' ? 'live feed' : 'demo data — connect INFLUENCER_API_KEY for live posts'}).`;
  grid.appendChild(note);
  for (const post of result.posts) {
    const card = document.createElement('div');
    card.className = 'inspo-card';
    const daysAgo = Math.round((Date.now() - new Date(post.date).getTime()) / 86400000);
    card.innerHTML = `
      <div class="inspo-swatch" style="background:${post.swatch}"></div>
      <div class="inspo-body">
        <span class="tag">${post.styleTag}</span>
        <p>${post.caption}</p>
        <span class="meta">${daysAgo}d ago · ${post.likes.toLocaleString()} likes</span>
      </div>
    `;
    grid.appendChild(card);
  }
}
