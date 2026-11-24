/**
 * Latest videos from the YouTube channel, read from the channel's public
 * feed at build time. With the hourly scheduled build (see
 * .github/workflows/main.yml) /videos and the homepage stay current with no
 * manual step.
 *
 * Only fields that change when a video is published are used (id, title,
 * date, description, Short or not). View counts are deliberately ignored:
 * they change every hour, and would make every scheduled build "different"
 * and redeploy the site for nothing.
 *
 * If the feed can't be read: in CI the build fails, so a network hiccup
 * never deploys an empty videos page over a good one (the next hourly run
 * retries); locally it warns and renders the empty state.
 */
import { YOUTUBE } from './site';

export type Video = {
  id: string;
  title: string;
  description: string;
  published: Date;
  short: boolean;
  url: string;
  thumbnail: string;
};

const FEED = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE.channelId}`;

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const clean = (s: string) => decode(s).replace(/#\S+/gu, '').replace(/\s+/g, ' ').trim();
const pick = (xml: string, re: RegExp) => xml.match(re)?.[1] ?? '';

export function parseFeed(xml: string): Video[] {
  const since = new Date(`${YOUTUBE.since}T00:00:00Z`);
  const hidden = new Set<string>(YOUTUBE.hidden);
  const videos: Video[] = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = pick(entry, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    const title = clean(pick(entry, /<title>([^<]*)<\/title>/));
    const published = new Date(pick(entry, /<published>([^<]+)<\/published>/));
    const link = pick(entry, /<link rel="alternate" href="([^"]+)"/);
    if (!id || !title || hidden.has(id) || Number.isNaN(published.getTime()) || published < since) continue;
    const short = link.includes('/shorts/');
    videos.push({
      id,
      title,
      description: clean(pick(entry, /<media:description>([\s\S]*?)<\/media:description>/)).slice(0, 180),
      published,
      short,
      url: short ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
  }
  return videos.sort((a, b) => b.published.valueOf() - a.published.valueOf());
}

let cached: Promise<Video[]> | undefined;

async function load(): Promise<Video[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(FEED, { headers: { 'user-agent': 'miladebrahimi.me build' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      if (!xml.includes('<feed')) throw new Error('response is not a feed');
      return parseFeed(xml);
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  const message = `Could not read the YouTube feed (${String(lastError)}).`;
  if (process.env.CI) throw new Error(`${message} Failing the build so an empty videos page is never deployed.`);
  console.warn(`[youtube] ${message} Rendering without videos.`);
  return [];
}

/** All recent videos, newest first. Fetched once per build. */
export function getVideos(): Promise<Video[]> {
  cached ??= load();
  return cached;
}
