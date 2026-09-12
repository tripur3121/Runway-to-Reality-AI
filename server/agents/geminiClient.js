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
