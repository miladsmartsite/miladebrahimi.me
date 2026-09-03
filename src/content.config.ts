import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Shared fields every collection uses to control publication state.
 * `draft: true` keeps an entry out of production listings entirely.
 * `placeholder: true` is different: the entry IS shown (so sections don't
 * look empty before real content exists), but templates render a visible
 * "Placeholder" tag on it — an honest, in-UI mark rather than something
 * only visible in the source file.
 */
const publishState = {
  draft: z.boolean().default(false),
  placeholder: z.boolean().default(false),
  order: z.number().default(0),
};

// Excludes README.md — a per-collection workflow doc (see
// src/content/articles/README.md), not real content, so it must never be
// scanned as an entry or it'd fail schema validation at build time.
const contentPattern = ['**/*.md', '!README.md'];

const projects = defineCollection({
  loader: glob({ pattern: contentPattern, base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    // Free-form tags rather than a fixed enum — positioning across the
    // practice areas (Business Operations, Systems, Marketing, AI, etc.)
    // is not finalized yet, so this must stay easy to relabel.
    tags: z.array(z.string()).default([]),
    role: z.string().optional(),
    client: z.string().optional(),
    year: z.string().optional(),
    coverImage: z.string().optional(),
    externalUrl: z.string().url().optional(),
    featured: z.boolean().default(false),
    // Which conceptual SystemPreview visualization represents this system —
    // always a recreated/abstract diagram, never a real screenshot (several
    // real systems involve confidential company data).
    previewType: z.enum(['dashboard', 'workflow', 'reporting', 'operations', 'marketing']).optional(),
    // Structured case-study fields for the project detail page — mirrors the
    // ten-part case-study structure (context/problem/role/approach/system/
    // how it works/tools/implementation/outcome/lessons). All optional: a
    // real system can be published with only the fields that are actually
    // evidenced, rather than waiting for every field to be filled in.
    context: z.string().optional(),
    problem: z.string().optional(),
    challenge: z.string().optional(),
    approach: z.string().optional(),
    system: z.string().optional(),
    howItWorks: z.string().optional(),
    tools: z.array(z.string()).default([]),
    implementation: z.string().optional(),
    outcome: z.string().optional(),
    // Short, explicit note on what evidence exists for the outcome — lets a
    // case study say "here's what's confirmed so far" without implying a
    // metric that isn't backed by evidence.
    evidenceNote: z.string().optional(),
    lessons: z.string().optional(),
    // True when the public write-up deliberately uses a recreated/redacted
    // description or diagram instead of the real internal document, because
    // the source material contains confidential or third-party information.
    redacted: z.boolean().default(false),
    ...publishState,
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: contentPattern, base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    coverImage: z.string().optional(),
    // A short pull-quote rendered as a large editorial statement partway
    // through the piece — optional, purely presentational, never required.
    quote: z.string().optional(),
    // An embeddable video URL (YouTube/Vimeo/LinkedIn) shown via
    // VideoFeature.astro instead of/alongside the written piece.
    videoUrl: z.string().url().optional(),
    // Set when the piece lives on an external platform (LinkedIn, Medium)
    // rather than being authored as a page on this site.
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
