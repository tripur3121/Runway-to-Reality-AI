import { api } from './api.js';
import { toast } from './toast.js';

let members = [];
let sourceMode = 'upload';
let lastResults = [];

function memberName(id) {
  const m = members.find((mm) => mm.id === id);
  return m ? m.name : id;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const comma = dataUrl.indexOf(',');
      resolve(dataUrl.slice(comma + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isYoutubeUrl(url) {
  return /(^https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
}

function matchRow(match, detectedId, isAlt) {
  const row = document.createElement('div');
  row.className = `outfit-match-row${isAlt ? ' outfit-match-row-alt' : ''}`;
  const taken = Boolean(match.claimedBy);

  const info = document.createElement('div');
  info.className = 'outfit-match-info';
  info.innerHTML = `
    <b>${match.name}</b>
    <span class="spec">${match.fabric} · ${match.brand} · ${memberName(match.ownerId)}'s closet</span>
    <span class="similarity">${match.similarity}% match</span>
  `;
  row.appendChild(info);

  const actions = document.createElement('div');
  actions.className = 'outfit-match-actions';
  if (taken) {
    const note = document.createElement('span');
    note.className = 'spec-line';
    note.textContent = `With ${memberName(match.claimedBy)} right now`;
    actions.appendChild(note);
  } else {
    const select = document.createElement('select');
    select.innerHTML = '<option value="">Borrow as…</option>' + members
      .filter((m) => m.id !== match.ownerId)
      .map((m) => `<option value="${m.id}">${m.name}</option>`)
      .join('');
    const borrowBtn = document.createElement('button');
    borrowBtn.className = 'btn btn-primary';
    borrowBtn.textContent = 'Borrow';
    borrowBtn.disabled = true;
    select.addEventListener('change', () => { borrowBtn.disabled = !select.value; });
    borrowBtn.addEventListener('click', async () => {
      try {
        await api.claimItem(match.itemId, select.value);
        toast(`${memberName(select.value)} claimed the ${match.name}`);
        match.claimedBy = select.value;
        renderResults(lastResults);
      } catch (err) {
        toast(err.message);
      }
    });
    actions.appendChild(select);
    actions.appendChild(borrowBtn);
  }
  row.appendChild(actions);
  return row;
}

function detectedCard(detected) {
  const card = document.createElement('div');
  card.className = 'outfit-detected-card';
  card.innerHTML = `
    <div class="outfit-detected-head">
      <span class="outfit-category">${detected.category}</span>
      <h4>${detected.label}</h4>
      ${detected.notes ? `<p class="muted small">${detected.notes}</p>` : ''}
    </div>
  `;

  if (detected.bestMatch) {
    const label = document.createElement('p');
    label.className = 'outfit-section-label';
    label.textContent = 'Best match in the shared closet';
    card.appendChild(label);
    card.appendChild(matchRow(detected.bestMatch, detected.id, false));
  } else {
    const none = document.createElement('p');
    none.className = 'muted small';
    none.textContent = 'Nothing close in the closet — here are the nearest options:';
    card.appendChild(none);
  }

  if (detected.alternatives.length) {
    const altLabel = document.createElement('p');
    altLabel.className = 'outfit-section-label';
    altLabel.textContent = detected.bestMatch ? 'Other options' : 'Similar alternatives';
    card.appendChild(altLabel);
    for (const alt of detected.alternatives) {
      card.appendChild(matchRow(alt, detected.id, true));
    }
  }

  return card;
}

function renderResults(items) {
  lastResults = items;
  const wrap = document.getElementById('outfit-results');
  wrap.innerHTML = '';
  if (!items.length) return;
  for (const detected of items) {
    wrap.appendChild(detectedCard(detected));
  }
}

async function analyze() {
  const btn = document.getElementById('analyze-outfit-btn');
  const status = document.getElementById('outfit-status');
  status.classList.remove('hidden');
  document.getElementById('outfit-results').innerHTML = '';
  btn.disabled = true;

  try {
    let payload;
    if (sourceMode === 'upload') {
      const fileInput = document.getElementById('outfit-file-input');
      const file = fileInput.files[0];
      if (!file) throw new Error('Choose a video file first.');
      status.textContent = 'Uploading video…';
      const videoBase64 = await fileToBase64(file);
      payload = { videoBase64, mimeType: file.type || 'video/mp4', filename: file.name };
    } else {
      const url = document.getElementById('outfit-url-input').value.trim();
      if (!url) throw new Error('Paste a video URL first.');
      payload = isYoutubeUrl(url) ? { youtubeUrl: url } : { videoUrl: url };
    }

    status.textContent = 'Gemini is watching the video and checking the closet — this can take a minute…';
    const result = await api.analyzeOutfitVideo(payload);
    renderResults(result.items);
    status.textContent = result.items.length
      ? `Found ${result.items.length} item${result.items.length === 1 ? '' : 's'}.`
      : 'No clothing items were detected in that video.';
  } catch (err) {
    status.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

export function initOutfitFinder() {
  api.getState().then((state) => { members = state.members; });

  document.getElementById('outfit-source-tabs').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    sourceMode = chip.dataset.source;
    document.querySelectorAll('#outfit-source-tabs .chip').forEach((c) => c.classList.toggle('active', c === chip));
    document.getElementById('outfit-upload-panel').classList.toggle('hidden', sourceMode !== 'upload');
    document.getElementById('outfit-url-panel').classList.toggle('hidden', sourceMode !== 'url');
  });

  document.getElementById('analyze-outfit-btn').addEventListener('click', analyze);
}
