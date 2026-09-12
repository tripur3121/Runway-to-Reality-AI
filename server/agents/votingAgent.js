import { votes } from '../data/store.js';

export const AGENT_INFO = {
  id: 'voting',
  name: 'Voting Agent',
  specialty: 'Tallies live Fit Check reactions into a group approval gauge.',
};

const TARGET = { fire: 90, slay: 90, swap: 50, pass: 10 };
const REACTION_EMOJI = { fire: '🔥', slay: '💅', swap: '👟', pass: '🙅' };

export function castVote(reaction) {
  if (!(reaction in TARGET)) throw new Error('unknown reaction');
  votes[reaction] += 1;
  votes.log.push({ reaction, at: Date.now() });
  if (votes.log.length > 200) votes.log.shift();
  return getScore();
}

export function getScore() {
  const total = votes.fire + votes.slay + votes.swap + votes.pass;
  let raw = 50;
  if (total > 0) {
    const sum = votes.fire * TARGET.fire + votes.slay * TARGET.slay + votes.swap * TARGET.swap + votes.pass * TARGET.pass;
    raw = Math.max(0, Math.min(100, sum / total));
  }
  return {
    score: Math.round(raw),
    counts: { fire: votes.fire, slay: votes.slay, swap: votes.swap, pass: votes.pass },
    emoji: REACTION_EMOJI,
  };
}

export function resetVotes() {
  votes.fire = 0;
  votes.slay = 0;
  votes.swap = 0;
  votes.pass = 0;
  votes.log = [];
  return getScore();
}
