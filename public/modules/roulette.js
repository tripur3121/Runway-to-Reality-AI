import { api } from './api.js';

export function initRoulette() {
  document.getElementById('spin-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = '🎡 Spinning…';
    try {
      const result = await api.spinRoulette();
      render(result);
    } finally {
      btn.disabled = false;
      btn.textContent = '🎡 Spin the Wheel';
    }
  });
}

function render(result) {
  const wrap = document.getElementById('roulette-result');
  wrap.innerHTML = '';
  for (const pick of result.picks) {
    const card = document.createElement('div');
    card.className = 'roulette-card';
    card.innerHTML = `
      <h4>${pick.name}</h4>
      <p>${pick.item.name}</p>
      <p class="muted small">from ${pick.item.ownerId}'s closet · ${pick.item.fabric}</p>
    `;
    wrap.appendChild(card);
  }
}
