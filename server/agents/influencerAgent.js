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

async function fetchFromProvider(handle) {
  const key = process.env.INFLUENCER_API_KEY;
  if (key) {
    try {
      return null;
    } catch {
      return null;
    }
  }
  return null;
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
