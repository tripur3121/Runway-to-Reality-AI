import { api } from './api.js';

export async function initAgents() {
  const { agents } = await api.getAgents();
  const grid = document.getElementById('agents-grid');
  grid.innerHTML = '';
  for (const agent of agents) {
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.innerHTML = `
      <h4>${agent.name}</h4>
      <p class="muted">${agent.specialty}</p>
      <span class="agent-badge">${agent.poweredBy}</span>
    `;
    grid.appendChild(card);
  }
}
