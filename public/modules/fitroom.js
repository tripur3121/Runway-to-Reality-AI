import { api } from './api.js';

const ROOM = 'fitting-room';
const REACTION_EMOJI = { fire: '🔥', slay: '💅', swap: '👟', pass: '🙅' };
const HEARTBEAT_MS = 10_000;

const clientId = `peer-${Math.random().toString(36).slice(2, 10)}`;

let pc = null;
let localStream = null;
let remoteClientId = null;
let joined = false;
let heartbeatTimer = null;
let micOn = true;
let camOn = true;

function $(id) {
  return document.getElementById(id);
}

function setRemoteLabel(text) {
  $('remote-label').textContent = text;
}

async function createPeerConnection(targetId) {
  remoteClientId = targetId;
  pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      api.rtcSend({ room: ROOM, from: clientId, to: remoteClientId, type: 'ice', data: e.candidate }).catch(() => {});
    }
  };

  pc.ontrack = (e) => {
    $('remote-video').srcObject = e.streams[0];
    setRemoteLabel('Connected');
  };

  pc.onconnectionstatechange = () => {
    if (pc && (pc.connectionState === 'disconnected' || pc.connectionState === 'failed')) {
      setRemoteLabel('Waiting for a second tab…');
    }
  };

  return pc;
}

async function startAsCaller(targetId) {
  await createPeerConnection(targetId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await api.rtcSend({ room: ROOM, from: clientId, to: targetId, type: 'offer', data: offer });
}

async function handleOffer(fromId, offer) {
  if (!pc) await createPeerConnection(fromId);
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await api.rtcSend({ room: ROOM, from: clientId, to: fromId, type: 'answer', data: answer });
}

async function handleAnswer(answer) {
  if (pc) await pc.setRemoteDescription(answer);
}

async function handleIce(candidate) {
  if (pc) {
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      /* candidate arrived before remote description; safe to ignore */
    }
  }
}

export async function joinCall() {
  if (joined) return;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (err) {
    setRemoteLabel('Camera/mic permission denied');
    throw err;
  }
  $('local-video').srcObject = localStream;
  joined = true;
  $('join-call-btn').disabled = true;
  $('mute-btn').disabled = false;
  $('cam-btn').disabled = false;
  $('leave-call-btn').disabled = false;

  await api.rtcPresence({ room: ROOM, clientId, action: 'join' });
  heartbeatTimer = setInterval(() => {
    api.rtcPresence({ room: ROOM, clientId, action: 'join' }).catch(() => {});
  }, HEARTBEAT_MS);
}

export async function leaveCall() {
  if (!joined) return;
  joined = false;
  clearInterval(heartbeatTimer);
  if (pc) {
    pc.close();
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  $('local-video').srcObject = null;
  $('remote-video').srcObject = null;
  remoteClientId = null;
  setRemoteLabel('Waiting for a second tab…');
  $('join-call-btn').disabled = false;
  $('mute-btn').disabled = true;
  $('cam-btn').disabled = true;
  $('leave-call-btn').disabled = true;
  await api.rtcPresence({ room: ROOM, clientId, action: 'leave' }).catch(() => {});
}

function toggleMic() {
  if (!localStream) return;
  micOn = !micOn;
  localStream.getAudioTracks().forEach((t) => (t.enabled = micOn));
  $('mute-btn').textContent = micOn ? 'Mute' : 'Unmute';
}

function toggleCam() {
  if (!localStream) return;
  camOn = !camOn;
  localStream.getVideoTracks().forEach((t) => (t.enabled = camOn));
  $('cam-btn').textContent = camOn ? 'Camera Off' : 'Camera On';
}

function spawnEmojiBurst(reaction) {
  const layer = $('emoji-burst-layer');
  const emoji = REACTION_EMOJI[reaction] || '✨';
  const count = 5;
  for (let i = 0; i < count; i += 1) {
    const span = document.createElement('span');
    span.className = 'floating-emoji';
    span.textContent = emoji;
    span.style.left = `${10 + Math.random() * 80}%`;
    span.style.animationDelay = `${i * 80}ms`;
    layer.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
  }
}

function updateGauge(score) {
  $('gauge-fill').style.width = `${score.score}%`;
  $('gauge-label').textContent = score.score;
}

export function initFittingRoom() {
  $('join-call-btn').addEventListener('click', () => joinCall().catch(() => {}));
  $('leave-call-btn').addEventListener('click', () => leaveCall());
  $('mute-btn').addEventListener('click', toggleMic);
  $('cam-btn').addEventListener('click', toggleCam);

  document.querySelectorAll('.reaction-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      api.vote(btn.dataset.reaction).catch(() => {});
    });
  });

  api.getVotes().then(updateGauge).catch(() => {});

  window.addEventListener('beforeunload', () => {
    if (!joined) return;
    navigator.sendBeacon(
      '/api/rtc/presence',
      new Blob([JSON.stringify({ room: ROOM, clientId, action: 'leave' })], { type: 'application/json' }),
    );
  });
}

export function onModalClosed() {
  leaveCall().catch(() => {});
}

export function handleServerEvent(type, payload) {
  if (type === 'rtc-presence' && payload.room === ROOM) {
    const others = payload.peers.filter((p) => p !== clientId);
    if (joined && others.length && !pc) {
      const target = others[0];
      if (clientId < target) {
        startAsCaller(target).catch(() => {});
      } else {
        setRemoteLabel('Waiting for the other tab to connect…');
      }
    }
    return;
  }

  if (type === 'rtc' && payload.room === ROOM && payload.to === clientId) {
    if (payload.type === 'offer') handleOffer(payload.from, payload.data).catch(() => {});
    else if (payload.type === 'answer') handleAnswer(payload.data).catch(() => {});
    else if (payload.type === 'ice') handleIce(payload.data).catch(() => {});
    return;
  }

  if (type === 'vote-cast') {
    spawnEmojiBurst(payload.reaction);
    updateGauge(payload.score);
    return;
  }

  if (type === 'votes-reset') {
    updateGauge(payload);
  }
}
