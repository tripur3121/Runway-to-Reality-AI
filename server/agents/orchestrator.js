import { hasGeminiKey } from './geminiClient.js';
import { AGENT_INFO as nudgeInfo } from './nudgeAgent.js';
import { AGENT_INFO as lookbookInfo } from './lookbookAgent.js';
import { AGENT_INFO as squadInfo } from './squadSyncAgent.js';
import { AGENT_INFO as rouletteInfo } from './rouletteAgent.js';
import { AGENT_INFO as votingInfo } from './votingAgent.js';
import { AGENT_INFO as influencerInfo } from './influencerAgent.js';

export const ROSTER = [nudgeInfo, lookbookInfo, squadInfo, rouletteInfo, votingInfo, influencerInfo].map((a) => ({
  ...a,
  poweredBy: hasGeminiKey() ? 'gemini-2.0-flash' : 'template-fallback',
}));
