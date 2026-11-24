import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedArticles } from '@lib/articles';
import { SITE } from '@lib/site';

/**
 * Published articles only (see src/lib/publication.ts): not a draft, not a
 * placeholder, and already due. A scheduled article appears in the feed on
 * the first build at or after its publishDate.
 */
export async function GET(context: APIContext) {
  const sorted = await getPublishedArticles();

  return rss({
    title: `${SITE.name} — Ideas`,
    description: 'Notes on operations, systems, and where AI actually helps.',
    site: context.site!,
    items: sorted.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.publishDate,
      ...(article.data.updatedDate ? { customData: `<updated>${article.data.updatedDate.toISOString()}</updated>` } : {}),
      link: `/contents/articles/${article.id}/`,
      categories: [article.data.category, ...article.data.tags],
      author: article.data.author,
    })),
    customData: '<language>en-us</language>',
  });
}
