import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { members, items, memberById, itemById, influencers } from './data/store.js';
import { draftNudge } from './agents/nudgeAgent.js';
import { curateOutfit, stylingTip, veoPrompt } from './agents/lookbookAgent.js';
import { styleSquad } from './agents/squadSyncAgent.js';
import { spin as rouletteSpin } from './agents/rouletteAgent.js';
import { castVote, getScore, resetVotes } from './agents/votingAgent.js';
import { getInspo } from './agents/influencerAgent.js';
import { ROSTER } from './agents/orchestrator.js';
import { generateVideo } from './agents/geminiClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 8787;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
};

const sseClients = new Set();
const rtcRooms = new Map();

function broadcast(type, payload) {
  const line = `data: ${JSON.stringify({ type, payload })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(line);
    } catch {
      sseClients.delete(res);
    }
  }
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'access-control-allow-origin': '*',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

async function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      return serveStatic(req, res, path.join(rel, 'index.html'));
    }
    const ext = path.extname(filePath);
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    stream.pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}

function stateSnapshot() {
  return { members, items };
}

async function handleApi(req, res, pathname, query) {
  const segs = pathname.split('/').filter(Boolean);

  if (pathname === '/api/state' && req.method === 'GET') {
    return sendJson(res, 200, stateSnapshot());
  }

  if (pathname === '/api/agents' && req.method === 'GET') {
    return sendJson(res, 200, { agents: ROSTER });
  }

  if (pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'access-control-allow-origin': '*',
    });
    res.write(`data: ${JSON.stringify({ type: 'hello', payload: stateSnapshot() })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (segs[0] === 'api' && segs[1] === 'items' && segs[3] === 'claim' && req.method === 'POST') {
    const item = itemById(segs[2]);
    if (!item) return sendJson(res, 404, { error: 'item not found' });
    const body = await readBody(req);
    const member = memberById(body.by);
    if (!member) return sendJson(res, 400, { error: 'unknown member' });
    if (item.claimedBy) return sendJson(res, 409, { error: 'already claimed' });
    item.claimedBy = member.id;
    broadcast('item-updated', { item });
    return sendJson(res, 200, { item });
  }

  if (segs[0] === 'api' && segs[1] === 'items' && segs[3] === 'release' && req.method === 'POST') {
    const item = itemById(segs[2]);
    if (!item) return sendJson(res, 404, { error: 'item not found' });
    item.claimedBy = null;
    broadcast('item-updated', { item });
    return sendJson(res, 200, { item });
  }

  if (segs[0] === 'api' && segs[1] === 'items' && segs[3] === 'laundry' && req.method === 'POST') {
    const item = itemById(segs[2]);
    if (!item) return sendJson(res, 404, { error: 'item not found' });
    const body = await readBody(req);
    item.laundry = body.status === 'hamper' ? 'hamper' : 'fresh';
    broadcast('item-updated', { item });
    return sendJson(res, 200, { item });
  }

  if (pathname === '/api/nudge' && req.method === 'POST') {
    const body = await readBody(req);
    const item = itemById(body.itemId);
    if (!item || !item.claimedBy) return sendJson(res, 400, { error: 'item is not currently borrowed' });
    const owner = memberById(item.ownerId);
    const borrower = memberById(item.claimedBy);
    const result = await draftNudge(item, owner, borrower);
    broadcast('nudge-sent', { itemId: item.id, ...result });
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/lookbook/curate' && req.method === 'POST') {
    const outfit = curateOutfit();
    const tips = {};
    for (const m of members) {
      tips[m.id] = await stylingTip(m.id, outfit);
    }
    const prompts = {};
    for (const m of members) {
      prompts[m.id] = veoPrompt(outfit, m.id);
    }
    const result = { outfit, tips, veoPrompts: prompts };
    broadcast('lookbook-curated', result);
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/lookbook/video' && req.method === 'POST') {
    const body = await readBody(req);
    const prompt = (body.prompt || '').slice(0, 2000);
    if (!prompt) return sendJson(res, 400, { error: 'prompt required' });
    try {
      const buffer = await generateVideo(prompt);
      const filename = `veo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
      const dir = path.join(PUBLIC_DIR, 'generated');
      await fsp.mkdir(dir, { recursive: true });
      await fsp.writeFile(path.join(dir, filename), buffer);
      return sendJson(res, 200, { videoUrl: `/generated/${filename}` });
    } catch (e) {
      return sendJson(res, 502, { error: e.message });
    }
  }

  if (pathname === '/api/squadsync' && req.method === 'POST') {
    const body = await readBody(req);
    const eventName = (body.event || 'Group Hangout').slice(0, 80);
    const result = await styleSquad(eventName);
    broadcast('squadsync-ready', result);
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/roulette/spin' && req.method === 'POST') {
    const result = rouletteSpin();
    broadcast('roulette-spun', result);
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/vote' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const score = castVote(body.reaction);
      broadcast('vote-cast', { reaction: body.reaction, score });
      return sendJson(res, 200, score);
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/votes' && req.method === 'GET') {
    return sendJson(res, 200, getScore());
  }

  if (pathname === '/api/votes/reset' && req.method === 'POST') {
    const score = resetVotes();
    broadcast('votes-reset', score);
    return sendJson(res, 200, score);
  }

  if (pathname === '/api/influencers' && req.method === 'GET') {
    return sendJson(res, 200, { influencers });
  }

  if (pathname === '/api/influencers' && req.method === 'POST') {
    const body = await readBody(req);
    const handle = (body.handle || '').trim().replace(/^@/, '');
    if (!handle) return sendJson(res, 400, { error: 'handle required' });
    if (!influencers.includes(handle)) influencers.push(handle);
    broadcast('influencer-added', { handle });
    return sendJson(res, 200, { influencers });
  }

  if (segs[0] === 'api' && segs[1] === 'influencers' && segs[3] === 'inspo' && req.method === 'GET') {
    const handle = decodeURIComponent(segs[2]);
    const result = await getInspo(handle);
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/rtc/send' && req.method === 'POST') {
    const body = await readBody(req);
    broadcast('rtc', body);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/rtc/presence' && req.method === 'POST') {
    const body = await readBody(req);
    const { room, clientId, action } = body;
    if (!room || !clientId) return sendJson(res, 400, { error: 'room and clientId required' });
    if (!rtcRooms.has(room)) rtcRooms.set(room, new Map());
    const roster = rtcRooms.get(room);
    if (action === 'leave') {
      roster.delete(clientId);
    } else {
      roster.set(clientId, Date.now());
      for (const [cid, ts] of roster) {
        if (Date.now() - ts > 30_000) roster.delete(cid);
      }
    }
    const peers = [...roster.keys()];
    broadcast('rtc-presence', { room, peers });
    return sendJson(res, 200, { peers });
  }

  return sendJson(res, 404, { error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    return res.end();
  }

  if (pathname.startsWith('/api/')) {
    try {
      return await handleApi(req, res, pathname, url.searchParams);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Runway to Reality AI running on http://localhost:${PORT}`);
});
