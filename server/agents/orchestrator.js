import { hasGeminiKey } from './geminiClient.js';
import { AGENT_INFO as nudgeInfo } from './nudgeAgent.js';
import { AGENT_INFO as lookbookInfo } from './lookbookAgent.js';
import { AGENT_INFO as squadInfo } from './squadSyncAgent.js';
import { AGENT_INFO as rouletteInfo } from './rouletteAgent.js';
import { AGENT_INFO as votingInfo } from './votingAgent.js';
import { AGENT_INFO as influencerInfo } from './influencerAgent.js';
import { AGENT_INFO as outfitFinderInfo } from './outfitFinderAgent.js';

// Agents with no offline fallback (nothing sensible to fake) report a
// distinct status when unconfigured instead of the templated ones' "falls
// back to a template bank" story.
const NO_FALLBACK_AGENTS = new Set([outfitFinderInfo.id]);

export const ROSTER = [nudgeInfo, lookbookInfo, squadInfo, rouletteInfo, votingInfo, influencerInfo, outfitFinderInfo].map((a) => {
  const hasKey = hasGeminiKey();
  let poweredBy = hasKey ? 'gemini-2.0-flash' : 'template-fallback';
  if (!hasKey && NO_FALLBACK_AGENTS.has(a.id)) poweredBy = 'needs GEMINI_API_KEY';
  return { ...a, poweredBy };
});
