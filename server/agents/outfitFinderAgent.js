import { uploadVideoToGemini, analyzeVideoOutfit } from './geminiClient.js';
import { items as allItems, itemById, memberById } from '../data/store.js';

export const AGENT_INFO = {
  id: 'outfitfinder',
  name: 'Outfit Finder Agent',
  specialty: 'Watches a video, identifies each clothing item, and matches it to real pieces in the shared closet.',
};

const MAX_VIDEO_BYTES = 90 * 1024 * 1024;

function inventorySnapshot() {
  return allItems.map((i) => ({
    id: i.id,
    ownerId: i.ownerId,
    name: i.name,
    category: i.category,
    fabric: i.fabric,
    brand: i.brand,
    claimed: Boolean(i.claimedBy),
  }));
}

function hydrateMatch(match) {
  if (!match || !match.itemId) return null;
  const item = itemById(match.itemId);
  if (!item) return null;
  const owner = memberById(item.ownerId);
  return {
    itemId: item.id,
    name: item.name,
    fabric: item.fabric,
    brand: item.brand,
    ownerId: item.ownerId,
    ownerName: owner ? owner.name : item.ownerId,
    claimedBy: item.claimedBy,
    similarity: Math.max(0, Math.min(100, Math.round(Number(match.similarity) || 0))),
  };
}

/**
 * source is one of:
 *   { youtubeUrl }                     — passed straight to Gemini
 *   { videoUrl }                        — server fetches the bytes, must be a direct video/* URL
 *   { videoBase64, mimeType, filename } — an uploaded file from the browser
 */
export async function findOutfitFromVideo(source) {
  let fileRef;

  if (source.youtubeUrl) {
    fileRef = { youtubeUrl: source.youtubeUrl.trim() };
  } else {
    let buffer;
    let mimeType = source.mimeType || 'video/mp4';

    if (source.videoBase64) {
      buffer = Buffer.from(source.videoBase64, 'base64');
    } else if (source.videoUrl) {
      const res = await fetch(source.videoUrl);
      if (!res.ok) throw new Error(`Could not fetch that video URL (${res.status}).`);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.startsWith('video/')) {
        throw new Error(
          `That URL doesn't point directly at a video file (got "${contentType || 'unknown type'}"). ` +
            'Reel/TikTok page links won\'t work here — paste a direct video file link or a YouTube URL instead, or upload the file.',
        );
      }
      mimeType = contentType;
      buffer = Buffer.from(await res.arrayBuffer());
    } else {
      throw new Error('No video was provided.');
    }

    if (buffer.length > MAX_VIDEO_BYTES) {
      throw new Error(`That video is too large (limit ~${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)}MB) — try a shorter clip.`);
    }

    const uploaded = await uploadVideoToGemini(buffer, mimeType, source.filename || 'outfit-video');
    fileRef = { uri: uploaded.uri, mimeType: uploaded.mimeType };
  }

  const detected = await analyzeVideoOutfit(fileRef, inventorySnapshot());

  return detected.map((entry, idx) => ({
    id: `detected-${idx}`,
    label: entry.label || 'Unlabeled item',
    category: entry.category || 'other',
    notes: entry.notes || '',
    bestMatch: hydrateMatch(entry.bestMatch),
    alternatives: (entry.alternatives || []).map(hydrateMatch).filter(Boolean),
  }));
}
