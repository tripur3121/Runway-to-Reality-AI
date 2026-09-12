import { callGemini } from './geminiClient.js';

export const AGENT_INFO = {
  id: 'nudge',
  name: 'Nudge Agent',
  specialty: 'Drafts witty, non-passive-aggressive return reminders for borrowed pieces.',
};

const TEMPLATES = [
  (item, owner, borrower) =>
    `Hey ${borrower.name}! Your friendly neighborhood ${owner.name} here — my ${item.name} misses me. Return it before it files a missing person report? 👗🚨`,
  (item, owner, borrower) =>
    `${borrower.name}, this is a courtesy reminder from the Closet Police: the ${item.name} has overstayed its visa. Please release it back into ${owner.name}'s custody ASAP.`,
  (item, owner, borrower) =>
    `Not to be dramatic but I NEED my ${item.name} back, ${borrower.name}. It's basically part of my identity at this point. Love you, return it. — ${owner.name}`,
  (item, owner, borrower) =>
    `${borrower.name}!! The ${item.name} called, it wants to come home to ${owner.name}. Rent is due (in hugs). Send it back soon 💌`,
  (item, owner, borrower) =>
    `Gentle nudge from ${owner.name}: my ${item.name} has been on an extended vacation with you, ${borrower.name}. Time to book its flight home ✈️`,
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function draftNudge(item, owner, borrower) {
  const prompt = `Write one short, witty, playful text message (strictly under 30 words, no hashtags) from ${owner.name} to their roommate ${borrower.name}, reminding them to return the borrowed "${item.name}" (${item.fabric}). Warm and funny, never passive aggressive. Return only the message text.`;
  const aiText = await callGemini(prompt);
  if (aiText) return { text: aiText, source: 'gemini' };
  return { text: pick(TEMPLATES)(item, owner, borrower), source: 'template' };
}
