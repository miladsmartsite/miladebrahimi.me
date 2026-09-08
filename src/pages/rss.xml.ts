import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { SITE } from '@lib/site';

/**
 * Published articles only — a `placeholder: true` entry's own body says
 * "not yet published," so including it here would tell subscribers the
 * opposite of what the page itself says. The feed is legitimately empty
 * until the first real article ships.
 */
export async function GET(context: APIContext) {
  const articles = await getCollection('articles', ({ data }) => !data.draft && !data.placeholder);
  const sorted = articles.sort((a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf());

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
