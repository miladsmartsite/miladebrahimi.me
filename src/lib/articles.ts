import { getCollection } from 'astro:content';
import { isPublishedAt } from './publication';

/**
 * Every public-facing article query goes through here, so pages, previews,
 * RSS and the sitemap can never disagree about what is published. Newest
 * first. `now` is injectable for tests; in a build it is the build time.
 */
export async function getPublishedArticles(now: Date = new Date()) {
  const articles = await getCollection('articles', ({ data }) => isPublishedAt(data, now));
  return articles.sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());
}
