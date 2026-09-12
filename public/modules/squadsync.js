import { api } from './api.js';

export function initSquadSync() {
  document.getElementById('squadsync-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('squadsync-event');
    const event = input.value.trim() || 'Group Hangout';
    const result = await api.squadSync(event);
    render(result);
  });
}

function render(result) {
  const wrap = document.getElementById('squadsync-result');
  wrap.innerHTML = '';
  for (const look of result.looks) {
    const card = document.createElement('div');
    card.className = 'sync-card';
    card.innerHTML = `
      <h4>${look.name}</h4>
      <p class="muted small">Color role: <strong>${look.colorRole}</strong></p>
      <p>${look.item ? `${look.item.name} · ${look.item.fabric}` : 'No piece available'}</p>
    `;
    wrap.appendChild(card);
  }
  const note = document.createElement('p');
  note.className = 'sync-note';
  note.textContent = `"${result.event}" palette: ${result.palette.join(', ')} — ${result.note}`;
  wrap.appendChild(note);
}
