async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'request failed');
  }
  return res.json();
}

export const api = {
  getState: () => req('GET', '/api/state'),
  getAgents: () => req('GET', '/api/agents'),
  claimItem: (id, by) => req('POST', `/api/items/${id}/claim`, { by }),
  releaseItem: (id) => req('POST', `/api/items/${id}/release`, {}),
  setLaundry: (id, status) => req('POST', `/api/items/${id}/laundry`, { status }),
  nudge: (itemId) => req('POST', '/api/nudge', { itemId }),
  curateLookbook: () => req('POST', '/api/lookbook/curate', {}),
  generateVideo: (prompt) => req('POST', '/api/lookbook/video', { prompt }),
  analyzeOutfitVideo: (payload) => req('POST', '/api/outfit-finder/analyze', payload),
  squadSync: (event) => req('POST', '/api/squadsync', { event }),
  spinRoulette: () => req('POST', '/api/roulette/spin', {}),
  vote: (reaction) => req('POST', '/api/vote', { reaction }),
  getVotes: () => req('GET', '/api/votes'),
  getInfluencers: () => req('GET', '/api/influencers'),
  addInfluencer: (handle) => req('POST', '/api/influencers', { handle }),
  getInspo: (handle) => req('GET', `/api/influencers/${encodeURIComponent(handle)}/inspo`),
  rtcSend: (payload) => req('POST', '/api/rtc/send', payload),
  rtcPresence: (payload) => req('POST', '/api/rtc/presence', payload),
};

export function subscribeEvents(onMessage) {
  const es = new EventSource('/api/events');
  es.onmessage = (evt) => {
    try {
      const parsed = JSON.parse(evt.data);
      onMessage(parsed.type, parsed.payload);
    } catch {
      /* ignore malformed event */
    }
  };
  return es;
}
