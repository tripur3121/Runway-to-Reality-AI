import { members, items } from '../data/store.js';

export const AGENT_INFO = {
  id: 'roulette',
  name: 'Roulette Agent',
  specialty: 'Spins the wheel to pull one fusion piece per sibling for a dare look.',
};

export function spin() {
  const picks = members.map((m) => {
    const candidates = items.filter((i) => i.ownerId !== m.id && i.pool && !i.claimedBy);
    const fallback = items.filter((i) => i.ownerId !== m.id);
    const pool = candidates.length ? candidates : fallback;
    const item = pool[Math.floor(Math.random() * pool.length)];
    return { memberId: m.id, name: m.name, item };
  });
  return { picks, spunAt: new Date().toISOString() };
}
