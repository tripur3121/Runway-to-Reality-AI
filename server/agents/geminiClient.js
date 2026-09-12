const MODEL = 'gemini-2.0-flash';
const VEO_MODEL = process.env.VEO_MODEL || 'veo-2.0-generate-001';
const VEO_POLL_INTERVAL_MS = 8000;
const VEO_POLL_TIMEOUT_MS = 6 * 60 * 1000;

export async function callGemini(prompt, { temperature = 0.9 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature, maxOutputTokens: 200 },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch {
    return null;
  }
}

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a short video with Veo via the Gemini API's long-running-operation
 * pattern. Unverified against a live key (this environment has none) — the
 * request/poll/download shape follows Google's published Veo-on-Gemini-API
 * docs as of this writing, but Google has changed these endpoints before, so
 * treat this as a best-effort integration and check the current docs at
 * https://ai.google.dev/gemini-api/docs/video if it errors.
 * Throws a descriptive Error on any failure; never returns null silently,
 * since the caller needs to explain the failure to the user.
 */
export async function generateVideo(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set — Veo video generation needs the same key as text generation.');

  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${VEO_MODEL}:predictLongRunning?key=${key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { aspectRatio: '9:16', personGeneration: 'allow_adult' },
      }),
    },
  );
  if (!startRes.ok) {
    const body = await startRes.text().catch(() => '');
    throw new Error(`Veo request failed (${startRes.status}): ${body.slice(0, 300) || 'no response body — this key may not have Veo access yet.'}`);
  }
  const startData = await startRes.json();
  const opName = startData?.name;
  if (!opName) throw new Error('Veo did not return an operation name — response shape may have changed.');

  const deadline = Date.now() + VEO_POLL_TIMEOUT_MS;
  let op = startData;
  while (!op.done) {
    if (Date.now() > deadline) throw new Error('Veo generation timed out after 6 minutes.');
    await sleep(VEO_POLL_INTERVAL_MS);
    const pollRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${opName}?key=${key}`);
    if (!pollRes.ok) throw new Error(`Veo polling failed (${pollRes.status})`);
    op = await pollRes.json();
  }
  if (op.error) throw new Error(`Veo generation failed: ${op.error.message || JSON.stringify(op.error)}`);

  const sample = op.response?.generateVideoResponse?.generatedSamples?.[0];
  const fileUri = sample?.video?.uri;
  if (!fileUri) throw new Error('Veo finished but returned no video — response shape may have changed.');

  const videoRes = await fetch(`${fileUri}${fileUri.includes('?') ? '&' : '?'}alt=media&key=${key}`);
  if (!videoRes.ok) throw new Error(`Could not download the generated video (${videoRes.status})`);
  const buffer = Buffer.from(await videoRes.arrayBuffer());
  return buffer;
}

const FILE_POLL_INTERVAL_MS = 4000;
const FILE_POLL_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Uploads a video buffer via the Gemini Files API's resumable-upload
 * protocol (start -> upload+finalize -> poll until ACTIVE) and returns a
 * {uri, mimeType} reference usable in a generateContent `fileData` part.
 * Unverified against a live key, same caveat as generateVideo() above —
 * check https://ai.google.dev/gemini-api/docs/files if it errors.
 */
export async function uploadVideoToGemini(buffer, mimeType, displayName = 'upload') {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set.');

  const startRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${key}`, {
    method: 'POST',
    headers: {
      'x-goog-upload-protocol': 'resumable',
      'x-goog-upload-command': 'start',
      'x-goog-upload-header-content-length': String(buffer.length),
      'x-goog-upload-header-content-type': mimeType,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!startRes.ok) throw new Error(`Video upload could not start (${startRes.status}).`);
  const uploadUrl = startRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Gemini did not return an upload URL — the Files API response shape may have changed.');

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'content-length': String(buffer.length),
      'x-goog-upload-offset': '0',
      'x-goog-upload-command': 'upload, finalize',
    },
    body: buffer,
  });
  if (!uploadRes.ok) throw new Error(`Video upload failed (${uploadRes.status}).`);
  const uploaded = await uploadRes.json();
  let file = uploaded.file;
  if (!file?.uri) throw new Error('Gemini did not return a file reference after upload.');

  const deadline = Date.now() + FILE_POLL_TIMEOUT_MS;
  while (file.state === 'PROCESSING') {
    if (Date.now() > deadline) throw new Error('Video processing timed out.');
    await sleep(FILE_POLL_INTERVAL_MS);
    const pollRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}?key=${key}`);
    if (!pollRes.ok) throw new Error(`Checking video status failed (${pollRes.status}).`);
    file = await pollRes.json();
  }
  if (file.state !== 'ACTIVE') throw new Error(`Video failed to process (state: ${file.state || 'unknown'}).`);
  return { uri: file.uri, mimeType: file.mimeType || mimeType };
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    /* fall through to looser extraction below */
  }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* fall through */
    }
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* give up below */
    }
  }
  return null;
}

/**
 * Asks Gemini to watch a video (an uploaded file reference, or a YouTube URL
 * passed straight through since Gemini can fetch those itself) and return
 * every detected clothing item matched against the given closet inventory.
 * Throws a descriptive Error on any failure.
 */
export async function analyzeVideoOutfit({ uri, mimeType, youtubeUrl }, inventory) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set.');

  const instruction = `You are a fashion-vision assistant. Watch this video and identify every distinct clothing item and accessory worn by the main subject (outerwear, tops, bottoms, dresses, shoes, bags, jewelry, hats, etc.).

For each detected item, compare it against this shared closet inventory (JSON) and pick the single best match by visual similarity (silhouette, color, material, category) if a reasonable one exists, plus up to 2 further alternatives ranked by similarity — include alternatives even when no item is a great match, so the user always has options to consider:

${JSON.stringify(inventory)}

Reply with ONLY JSON, no commentary, no code fence, in exactly this shape:
{"items":[{"label":"short description of the detected item","category":"outerwear|top|bottom|dress|shoes|accessory","notes":"color/material/style detail","bestMatch":{"itemId":"<id from inventory>","similarity":<integer 0-100>}|null,"alternatives":[{"itemId":"<id from inventory>","similarity":<integer 0-100>}]}]}

Only ever reference "itemId" values that literally appear in the inventory above. If nothing resembles an item closely, set "bestMatch" to null but still return up to 2 alternatives.`;

  const fileDataPart = youtubeUrl
    ? { fileData: { fileUri: youtubeUrl, mimeType: 'video/*' } }
    : { fileData: { fileUri: uri, mimeType } };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [fileDataPart, { text: instruction }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini video analysis failed (${res.status}): ${body.slice(0, 300) || 'no response body.'}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no analysis — the video may have been blocked, too long, or unreadable.');
  const parsed = extractJson(text);
  if (!parsed?.items || !Array.isArray(parsed.items)) throw new Error("Gemini's reply wasn't in the expected format.");
  return parsed.items;
}
