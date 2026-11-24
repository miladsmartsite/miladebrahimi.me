import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { normalizePublishDate } from './lib/publication';
import { TOPICS } from './lib/site';

/**
 * Shared fields every collection uses to control publication state.
 * `draft: true` keeps an entry out of production entirely. For articles,
 * `placeholder: true` does the same (see src/lib/publication.ts); other
 * collections may still show a placeholder entry with a visible tag.
 */
const publishState = {
  draft: z.boolean().default(false),
  placeholder: z.boolean().default(false),
  order: z.number().default(0),
};

// Excludes README.md, a per-collection workflow doc, not real content.
const contentPattern = ['**/*.md', '!README.md'];

// Article topics come from site.ts TOPICS: the three pillars plus Business.
// A controlled vocabulary, so a typo'd topic fails the build instead of
// silently becoming its own orphan section on /ideas.
export const ARTICLE_CATEGORIES = TOPICS.map((t) => t.title) as [
  (typeof TOPICS)[number]['title'],
  ...(typeof TOPICS)[number]['title'][],
];

const projects = defineCollection({
  loader: glob({ pattern: contentPattern, base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    role: z.string().optional(),
    client: z.string().optional(),
    year: z.string().optional(),
    coverImage: z.string().optional(),
    externalUrl: z.string().url().optional(),
    featured: z.boolean().default(false),
    // Which conceptual SystemPreview visualization represents this system:
    // always a recreated/abstract diagram, never a real screenshot.
    previewType: z.enum(['dashboard', 'workflow', 'reporting', 'operations', 'marketing']).optional(),
    // Case-study fields for the project detail page. All optional, so a
    // system can be published with only the fields that are evidenced.
    context: z.string().optional(),
    problem: z.string().optional(),
    challenge: z.string().optional(),
    approach: z.string().optional(),
    system: z.string().optional(),
    howItWorks: z.string().optional(),
    tools: z.array(z.string()).default([]),
    implementation: z.string().optional(),
    outcome: z.string().optional(),
    evidenceNote: z.string().optional(),
    lessons: z.string().optional(),
    redacted: z.boolean().default(false),
    ...publishState,
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: contentPattern, base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Interpreted in UTC; a missing/empty/non-date value fails the build
    // instead of coercing to 1970 (see src/lib/publication.ts).
    publishDate: z.preprocess(normalizePublishDate, z.coerce.date()),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Milad Ebrahimi'),
    // The article's one topic (see ARTICLE_CATEGORIES above).
    category: z.enum(ARTICLE_CATEGORIES),
    tags: z.array(z.string()).default([]),
    coverImage: z.string().optional(),
    featured: z.boolean().default(false),
    // A short pull-quote rendered as a large statement after the body.
    quote: z.string().optional(),
    // A YouTube video this article is the written version of.
    videoUrl: z.string().url().optional(),
    externalUrl: z.string().url().optional(),
    ...publishState,
  }),
});

const books = defineCollection({
  loader: glob({ pattern: contentPattern, base: './src/content/books' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    author: z.string().optional(),
    description: z.string(),
    coverImage: z.string().optional(),
    link: z.string().url().optional(),
    year: z.string().optional(),
    language: z.string().optional(),
    // Which pillar the book belongs to (see site.ts PILLARS).
    pillar: z.enum(['time-engineering', 'self-coaching', 'balance']).optional(),
    ...publishState,
  }),
});

const speaking = defineCollection({
  loader: glob({ pattern: contentPattern, base: './src/content/speaking' }),
  schema: z.object({
    title: z.string(),
    event: z.string(),
    location: z.string().optional(),
    date: z.coerce.date(),
    description: z.string(),
    videoUrl: z.string().url().optional(),
    slidesUrl: z.string().url().optional(),
    ...publishState,
  }),
});

const resources = defineCollection({
  loader: glob({ pattern: contentPattern, base: './src/content/resources' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['template', 'guide', 'framework', 'tool', 'download', 'link']),
    url: z.string().url().optional(),
    ...publishState,
  }),
});

const experience = defineCollection({
  loader: glob({ pattern: contentPattern, base: './src/content/experience' }),
  schema: z.object({
    organization: z.string(),
    role: z.string(),
    location: z.string().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional(), // omit for "present"
    summary: z.string(),
    ...publishState,
  }),
});

export const collections = {
  projects,
  articles,
  books,
  speaking,
  resources,
  experience,
};
