import { callGemini } from './geminiClient.js';
import { items as allItems, poolItems } from '../data/store.js';

export const AGENT_INFO = {
  id: 'lookbook',
  name: 'Lookbook Agent',
  specialty: 'Curates a shareable outfit from the pool and adapts styling notes per body type.',
};

const FALLBACK_TIPS = {
  petite: (item) => `On a petite 5'5" frame, the ${item.name} reads best cuffed or cropped — keep the hem above mid-calf so it elongates the leg line.`,
  tall: (item) => `At 6'1", the ${item.name} drapes long and lean — size up half a step in layering pieces so proportions stay balanced, not swallowed.`,
  mid: (item) => `At 5'8", the ${item.name} hits at a true, flattering length — a slight waist cinch keeps the silhouette sharp.`,
};

function heightBand(memberId) {
  if (memberId === 'maya') return 'petite';
  if (memberId === 'liam') return 'tall';
  return 'mid';
}

export function curateOutfit(seedMemberId = null) {
  const pool = poolItems();
  const categories = ['outerwear', 'top', 'bottom', 'dress', 'shoes'];
  const picked = [];
  const usedOwners = new Set();
  for (const cat of categories) {
    const candidates = pool.filter((i) => i.category === cat && !picked.includes(i));
    if (!candidates.length) continue;
    candidates.sort((a, b) => (usedOwners.has(a.ownerId) ? 1 : 0) - (usedOwners.has(b.ownerId) ? 1 : 0));
    const choice = candidates[Math.floor(Math.random() * Math.min(2, candidates.length))];
    if (choice) {
      picked.push(choice);
      usedOwners.add(choice.ownerId);
    }
    if (picked.length >= 4) break;
  }
  if (!picked.length) {
    picked.push(...allItems.slice(0, 3));
  }
  return picked;
}

export async function stylingTip(memberId, outfit) {
  const band = heightBand(memberId);
  const itemNames = outfit.map((i) => i.name).join(', ');
  const prompt = `In one punchy sentence (under 28 words), give a micro styling tip for how this outfit — ${itemNames} — should be worn on a ${heightLabel(memberId)} frame (size ${sizeLabel(memberId)}). Be specific and actionable, no fluff.`;
  const aiText = await callGemini(prompt);
  if (aiText) return { text: aiText, source: 'gemini' };
  const anchor = outfit[0] || { name: 'this piece' };
  return { text: FALLBACK_TIPS[band](anchor), source: 'template' };
}

function heightLabel(memberId) {
  return { maya: "5'5\" petite", liam: "6'1\" tall", sophie: "5'8\" mid-height" }[memberId] || '';
}
function sizeLabel(memberId) {
  return { maya: 'S', liam: 'L', sophie: 'M' }[memberId] || 'M';
}

export function veoPrompt(outfit, memberId) {
  const garments = outfit.map((i) => `${i.fabric} ${i.name.toLowerCase()} by ${i.brand}`).join(', ');
  return `Cinematic 4K fashion runway shot, 24fps, shallow depth of field. A confident model with a ${heightLabel(memberId)} build walks a minimalist runway toward camera, wearing: ${garments}. Soft directional studio lighting, subtle fabric movement and drape, slow dolly-in, seamless loop, high-fashion editorial color grade, no text overlays.`;
}
