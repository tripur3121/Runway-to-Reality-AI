import { callGemini } from './geminiClient.js';
import { members, items } from '../data/store.js';

export const AGENT_INFO = {
  id: 'squadsync',
  name: 'Squad Sync Agent',
  specialty: 'Assigns complementary color roles for an event so the whole group photographs cohesively.',
};

const PALETTE_BANK = [
  ['Terracotta', 'Cream', 'Espresso'],
  ['Sunset Coral', 'Sandstone', 'Deep Navy'],
  ['Sage Green', 'Ivory', 'Charcoal'],
  ['Dusty Rose', 'Camel', 'Black'],
  ['Ocean Blue', 'Bone White', 'Rust'],
];

function paletteForEvent(eventName) {
  let hash = 0;
  for (const ch of eventName) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE_BANK[hash % PALETTE_BANK.length];
}

function bestMatch(memberId, colorHint) {
  const owned = items.filter((i) => i.ownerId === memberId);
  const pool = items.filter((i) => i.pool && !i.claimedBy && i.ownerId !== memberId);
  const candidates = [...owned, ...pool];
  return candidates[Math.floor(Math.random() * candidates.length)] || owned[0];
}

export async function styleSquad(eventName) {
  const palette = paletteForEvent(eventName);
  const looks = members.map((m, idx) => {
    const colorRole = palette[idx % palette.length];
    const item = bestMatch(m.id, colorRole);
    return { memberId: m.id, name: m.name, colorRole, item };
  });

  const prompt = `Event: "${eventName}". Three friends (Maya, Liam, Sophie) are dressing in a coordinated palette of ${palette.join(', ')}, each assigned a role color: ${looks.map((l) => `${l.name}=${l.colorRole}`).join(', ')}. In one short sentence, give a fun group-styling note for how they'll photograph well together.`;
  const aiNote = await callGemini(prompt);
  const note = aiNote || `Anchor everyone in ${palette[0]}, ${palette[1]} and ${palette[2]} so the trio reads as one coordinated frame without matching outfits.`;

  return { event: eventName, palette, looks, note, source: aiNote ? 'gemini' : 'template' };
}
