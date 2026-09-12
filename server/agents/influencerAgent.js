export const AGENT_INFO = {
  id: 'influencer',
  name: 'Influencer Inspo Agent',
  specialty: 'Pulls a followed stylist\'s recent posts (last 3 months) and turns them into wearable inspo notes.',
};

const STYLE_TAGS = [
  'oversized tailoring', 'monochrome layering', 'texture mixing', 'street-luxe',
  'quiet luxury', 'vintage denim', 'color blocking', 'minimalist knitwear',
  'statement outerwear', 'soft grunge', 'coastal neutral', 'high-contrast accessorizing',
];

function seedFromHandle(handle) {
  let h = 0;
  for (const ch of handle) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function mockPostsFor(handle) {
  const seed = seedFromHandle(handle);
  const rand = mulberry32(seed);
  const posts = [];
  for (let i = 0; i < 8; i += 1) {
    const monthsAgo = Math.floor(rand() * 5);
    const daysAgo = monthsAgo * 30 + Math.floor(rand() * 28);
    const date = new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString();
    const tag = STYLE_TAGS[Math.floor(rand() * STYLE_TAGS.length)];
    const hue = `hsl(${Math.floor(rand() * 360)}, 55%, 72%)`;
    posts.push({
      id: `${handle}-post-${i}`,
      handle,
      date,
      styleTag: tag,
      caption: `${capitalize(tag)} moment — swipe for the breakdown.`,
      swatch: hue,
      likes: 200 + Math.floor(rand() * 9000),
    });
  }
  return posts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Real posts via Instagram's Business Discovery API — the legitimate way to
 * read ANOTHER public account's recent media without that account logging
 * in. Requires two things from the user, both from a Meta developer app:
 *   INSTAGRAM_BUSINESS_ID   — the id of the caller's OWN linked
 *                             Instagram Business/Creator account
 *   INSTAGRAM_ACCESS_TOKEN  — a long-lived token for that account with the
 *                             instagram_business_basic permission
 * The target handle (the influencer being looked up) must also be a public
 * Business or Creator account — personal accounts aren't discoverable this
 * way. Docs: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/business-discovery-api
 */
async function fetchFromProvider(handle) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const businessId = process.env.INSTAGRAM_BUSINESS_ID;
  if (!token || !businessId) return null;
  try {
    const fields = `business_discovery.username(${handle}){media.limit(25){caption,timestamp,like_count,media_type,media_url,thumbnail_url,permalink}}`;
    const url = `https://graph.facebook.com/v19.0/${businessId}?fields=${encodeURIComponent(fields)}&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const media = data?.business_discovery?.media?.data;
    if (!Array.isArray(media)) return null;
    return media.map((m, i) => {
      const rand = mulberry32(seedFromHandle(`${handle}-${i}`));
      return {
        id: m.id || `${handle}-live-${i}`,
        handle,
        date: m.timestamp,
        caption: (m.caption || 'No caption.').slice(0, 160),
        styleTag: STYLE_TAGS[Math.floor(rand() * STYLE_TAGS.length)],
        swatch: `hsl(${Math.floor(rand() * 360)}, 55%, 72%)`,
        mediaUrl: m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url,
        permalink: m.permalink,
        likes: m.like_count ?? 0,
      };
    });
  } catch {
    return null;
  }
}

export async function getInspo(handle) {
  const live = await fetchFromProvider(handle);
  const posts = live || mockPostsFor(handle);
  const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
  const recent = posts.filter((p) => new Date(p.date).getTime() >= cutoff);
  return {
    handle,
    source: live ? 'live' : 'mock',
    totalFetched: posts.length,
    withinThreeMonths: recent.length,
    posts: recent,
  };
}
