/**
 * Single source of truth for site-wide brand, navigation, and homepage
 * editorial copy. See src/content/content-status.md for what's CONFIRMED
 * vs. SUPPORTED vs. PROVISIONAL — every provisional string below is also
 * commented as such here. Change values here rather than hunting through
 * pages/components.
 */

export const SITE = {
  name: 'Milad Ebrahimi',
  brandName: 'MILAD EBRAHIMI',
  // PROVISIONAL — approved core positioning line (Phase 3).
  positioning: 'I build the systems that move organizations forward.',
  // The homepage's full <title> — the one page that states the complete
  // positioning up front rather than "[Page] — Milad Ebrahimi"; every
  // other page's title is built from its own name (see SEO.astro).
  homeTitle: 'Milad Ebrahimi — Business Operations, Systems & Organizational Transformation',
  url: 'https://miladebrahimi.me',
  // CONFIRMED BY MILAD — the public contact address. Do not use any other
  // email address found in the CV or project files.
  contactEmail: 'miladsmartsite@gmail.com',
  // CONFIRMED BY MILAD — current CV destination. External (Google Drive)
  // for now; every "Download CV" button reads from this one constant, so
  // swapping to a local PDF later (e.g. "/cv/milad-ebrahimi-cv.pdf") never
  // requires touching a component.
  cvUrl: 'https://drive.google.com/file/d/1Y1vseED44YG041s-mfOT-2QBprFe92nq/view?usp=drive_link',
  // Used as the fallback SEO description when a page doesn't define its own
  // (currently just the homepage, which has no more specific one of its own).
  defaultDescription:
    'Milad Ebrahimi builds the systems that move organizations forward — operations at the core, with marketing, productivity, AI, and leadership as connected areas.',
  // CV-verbatim (see master-profile.md) — used as Person.jobTitle in the
  // sitewide JSON-LD, not just page copy.
  jobTitle: 'Operations Manager',
  // Brand-typography fallback social-preview image (see
  // public/images/README.md) — used whenever a page doesn't have its own
  // more specific one (e.g. a real article/book cover, once one exists).
  defaultOgImage: '/images/og/default.png',
  locale: 'en',
} as const;

/**
 * Stable JSON-LD `@id` for the sitewide Person node (BaseLayout.astro).
 * Article and Book schema reference this same id via `{ '@id': PERSON_ID }`
 * instead of re-declaring a separate anonymous Person object per page —
 * so a crawler reads "Milad Ebrahimi, author of this article" and "Milad
 * Ebrahimi, the site's Person entity" as the literal same node, not two
 * same-named-but-unconnected ones (Phase 16 §3/§4).
 */
export const PERSON_ID = `${SITE.url}/#person`;

export type NavItem = {
  label: string;
  href: string;
};

export type MegaMenuLink = { label: string; href: string; description?: string; status?: 'in-development' };

// Phase 3 approved primary-nav structure. /about and /cv both still exist
// as thin redirects into /resume (the new merged "About Me & Resume"
// destination) — old links/bookmarks keep working. /books and /articles
// still exist at their original paths too (individual article pages are
// unchanged); their *index* pages now redirect into /contents/articles
// and /contents/books, the new canonical listing locations, so there is
// one source for each listing rather than two. /speaking and /resources
// aren't in this nav structure at all — both still exist and are linked
// from /contents/more. Phase 6: Expertise/Work/Contents/About Me & Resume
// each open a MEGA_MENUS entry (see below) instead of a plain dropdown;
// Contact stays a direct link.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Expertise', href: '/expertise' },
  { label: 'Work', href: '/projects' },
  { label: 'Contents', href: '/contents' },
  { label: 'About Me & Resume', href: '/resume' },
  { label: 'Contact', href: '/contact' },
];

export type SocialLink = {
  label: string;
  href: string;
};

// CONFIRMED BY MILAD.
export const SOCIAL_LINKS: SocialLink[] = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/miladebrahimi-me' },
];

/** Topics Milad is open to professional conversations about — used on /contact. */
export const CONTACT_TOPICS = [
  'Business Operations',
  'Business Systems',
  'Process Improvement',
  'Marketing / Strategy',
  'AI / Digital Transformation',
  'Speaking / Writing / Collaboration',
];

export type ExpertiseArea = {
  code: string;
  title: string;
  description: string;
  /** How confidently this can be claimed, given current evidence. */
  standing: 'Core' | 'Practice' | 'Experience' | 'Focus';
  /** Short descriptor keywords shown under the title — restating the same claim, not new ones. */
  tags: string[];
  /** Project `tags` (see content/projects/*.md) this area's real systems are tagged with, if any — used to compute "Related Work" on /expertise without hard-coding titles that could drift. Empty where no system is tagged for this area yet (Productivity/AI/Leadership) — shown honestly, not papered over. */
  relatedTags: string[];
};

/**
 * Phase 3 approved five areas of practice — Operations is explicitly CORE;
 * the other four are lenses through which organizational improvement
 * happens, not separate service lines. Replaces the earlier seven-item
 * PRACTICE_AREAS. `standing` still avoids overclaiming "expertise" across
 * the board (see content-brief.md §5) — this is PROVISIONAL framing
 * language, not a final claim, but every underlying discipline it names is
 * CV-confirmed (see master-profile.md: "business operations, leadership,
 * marketing, and organizational development").
 */
export const EXPERTISE_AREAS: ExpertiseArea[] = [
  {
    code: '01',
    title: 'Operations',
    standing: 'Core',
    description: 'Building the structure behind effective organizations.',
    tags: ['Structure', 'Process', 'Systems'],
    // Deliberately excludes 'process-improvement': it's also on the
    // Marketing & Lead Operations System, and including it here would list
    // that system under Operations too. 'business-operations'/'systems'/
    // 'construction-real-estate' alone already correctly match every real
    // operations system (each carries at least one of these).
    relatedTags: ['business-operations', 'systems', 'construction-real-estate'],
  },
  {
    code: '02',
    title: 'Marketing',
    standing: 'Experience',
    description: 'Turning positioning, communication, and growth into repeatable systems.',
    tags: ['Growth', 'Positioning', 'Demand'],
    relatedTags: ['marketing'],
  },
  {
    code: '03',
    title: 'Productivity',
    standing: 'Focus',
    description: 'Designing better ways of working, prioritizing, and executing.',
    tags: ['Execution', 'Focus', 'Efficiency'],
    relatedTags: [],
  },
  {
    code: '04',
    title: 'AI',
    standing: 'Focus',
    description: 'Applying AI and automation to improve how work gets done.',
    tags: ['Applied AI', 'Automation', 'Leverage'],
    relatedTags: [],
  },
  {
    code: '05',
    title: 'Leadership',
    standing: 'Practice',
    description: 'Building clarity, accountability, and better ways of leading teams.',
    tags: ['People', 'Direction', 'Change'],
    relatedTags: [],
  },
];

/**
 * Phase 6 mega-menu content — "brand orientation systems," not decorative
 * dropdowns. Keyed by the matching NAV_ITEMS label so Nav.astro can look
 * each one up directly. The Expertise group is built from EXPERTISE_AREAS
 * itself (one source of truth, no drift risk); Work's system list is
 * populated at render time from the real `projects` collection (see
 * Nav.astro), not hard-coded here, so it can't drift from what's
 * actually published.
 */
export const MEGA_MENUS: Record<
  string,
  {
    number: string;
    label: string;
    statement: string;
    groups: { heading?: string; links: MegaMenuLink[] }[];
    explore: MegaMenuLink[];
  }
> = {
  Expertise: {
    number: '01',
    label: 'Expertise',
    statement: 'Areas where I work across structure, systems, people and growth.',
    groups: [
      {
        links: EXPERTISE_AREAS.map((area) => ({
          label: `${area.code} — ${area.title}`,
          href: '/expertise',
          description: area.tags.join(' · '),
        })),
      },
    ],
    explore: [
      { label: 'Expertise Overview', href: '/expertise' },
      { label: 'Expertise Matrix', href: '/expertise#matrix' },
    ],
  },
  Work: {
    number: '02',
    label: 'Work',
    statement: 'Systems and practical work I have built.',
    groups: [{ heading: 'Systems', links: [] }], // populated at render time from the projects collection — see Nav.astro
    explore: [
      { label: 'All Work', href: '/projects' },
      { label: 'Selected Work', href: '/#selected-work' },
    ],
  },
  Contents: {
    number: '03',
    label: 'Contents',
    statement: 'Ideas, frameworks and knowledge.',
    groups: [
      {
        links: [
          { label: 'Articles', href: '/contents/articles', description: 'Insights and practical frameworks' },
          { label: 'Books', href: '/contents/books', description: 'Published and developing books' },
          { label: 'Podcasts', href: '/contents/podcasts', description: 'Conversations and audio', status: 'in-development' },
          { label: 'Videos', href: '/contents/videos', description: 'Video content', status: 'in-development' },
          { label: 'More', href: '/contents/more', description: 'Additional content' },
        ],
      },
    ],
    explore: [{ label: 'Explore Contents', href: '/contents' }],
  },
  'About Me & Resume': {
    number: '04',
    label: 'About',
    statement: 'The person, the journey and the body of work.',
    groups: [
      {
        heading: 'About',
        links: [
          { label: 'Profile', href: '/resume#profile' },
          { label: 'Approach', href: '/resume#practice' },
          { label: 'Background', href: '/resume#career' },
        ],
      },
      {
        heading: 'Resume',
        links: [
          { label: 'Career', href: '/resume#career' },
          { label: 'Achievements', href: '/resume#achievements' },
          { label: 'Systems & Projects', href: '/resume#systems-projects' },
          { label: 'Certifications', href: '/resume#certifications' },
          { label: 'Books', href: '/resume#books' },
          { label: 'Education', href: '/resume#education' },
          { label: 'Tools', href: '/resume#tools' },
          { label: 'Languages', href: '/resume#languages' },
        ],
      },
    ],
    explore: [{ label: 'View Full Resume', href: '/resume' }],
  },
};

/**
 * Human-readable label for each system's `previewType` field — a
 * presentational mapping of an existing real field, not a new one.
 */
export const SYSTEM_TYPE_LABELS: Record<string, string> = {
  dashboard: 'Management System',
  workflow: 'Workflow System',
  reporting: 'Reporting System',
  operations: 'Operations System',
  marketing: 'Marketing System',
};

export type SystemMapNode = {
  key: string;
  label: string;
  caption: string;
};

/**
 * The "Milad System Map" — the site's one recurring interactive brand
 * element (hero + conceptually echoed elsewhere). Labels and captions are
 * PROVISIONAL positioning language, consistent with existing copy
 * elsewhere on the site — not new factual claims.
 */
export const SYSTEM_MAP_NODES: SystemMapNode[] = [
  { key: 'operations', label: 'Operations', caption: 'Keeping the day-to-day running.' },
  { key: 'systems', label: 'Systems', caption: 'Turning process into infrastructure.' },
  { key: 'strategy', label: 'Strategy', caption: 'Deciding what’s worth building.' },
  { key: 'ai', label: 'AI', caption: 'Applied where it changes an outcome.' },
  { key: 'marketing', label: 'Marketing', caption: 'Connecting work to the people who need it.' },
  { key: 'writing', label: 'Writing / Ideas', caption: 'Thinking in public, in writing.' },
];

/**
 * Short domain codes used for the "technical annotation" tick-row motif on
 * Selected Systems — derived directly from the `tags` already present on
 * each project entry, not invented. Order is fixed so the tick row reads
 * consistently across every system.
 */
export const DOMAIN_CODES: { tag: string; code: string }[] = [
  { tag: 'business-operations', code: 'OPS' },
  { tag: 'systems', code: 'SYS' },
  { tag: 'process-improvement', code: 'PROC' },
  { tag: 'marketing', code: 'MKT' },
  { tag: 'construction-real-estate', code: 'C/RE' },
];

// The condensed organization-level CAREER list (formerly used by the
// homepage's Career component) was removed — /resume now shows the full
// role-by-role `experience` collection directly via Timeline.astro, so a
// separate condensed duplicate isn't needed. See content-status.md.

export type ResultItem = {
  metric: string;
  detail: string;
  source: string;
};

/**
 * Results exactly as stated in the CV — CONFIRMED (CV-stated). Deliberately
 * NOT linked to any of the five systems in `projects/`: no evidence
 * connects these figures to that work, so they're kept as their own,
 * separately-sourced claims. See content-status.md.
 */
export const RESULTS: ResultItem[] = [
  {
    metric: '+30%',
    detail: 'Increased lead generation with a refined content strategy and stronger brand visuals.',
    source: 'Perla Engineering',
  },
  {
    metric: '+40%',
    detail: 'Boosted monthly inquiries through targeted social media campaigns.',
    source: 'SKYLAND Holding',
  },
  {
    metric: '+55%',
    detail: 'Improved engagement with structured content calendars and optimized Instagram posts.',
    source: 'Noor Alyaqoot',
  },
];

export type ProcessStep = {
  step: string;
  description: string;
  purpose: string;
  action: string;
  output: string;
};

/**
 * "The Milad Method" — a personal working framework, not an academically
 * validated methodology, a certification, or proprietary technology. See
 * /expertise and the homepage for the explicit framing ("Milad's way of
 * approaching organizational improvement"). PROVISIONAL — an original
 * framing for how the work actually proceeds, written for the site rather
 * than quoted from any source. `purpose`/`action`/`output` are the same
 * framing broken into the three fields shown per stage — an elaboration
 * of the approved one-line `description`, not a new claim.
 */
export const MILAD_METHOD: ProcessStep[] = [
  {
    step: 'Understand',
    description: 'Understand the organization, people, processes, problems, and objectives.',
    purpose: 'See how the organization actually works.',
    action: 'Understand people, processes, problems, and objectives.',
    output: 'A clear picture of the current state.',
  },
  {
    step: 'Structure',
    description: 'Create clarity across roles, responsibilities, workflows, and priorities.',
    purpose: 'Remove ambiguity about who owns what.',
    action: 'Define roles, responsibilities, workflows, and priorities.',
    output: 'A clear structure the organization can operate on.',
  },
  {
    step: 'Systemize',
    description: 'Turn repeatable work into practical systems, processes, and standards.',
    purpose: 'Make good work repeatable, not one-off.',
    action: 'Turn recurring work into practical systems, processes, and standards.',
    output: 'Working systems people actually use.',
  },
  {
    step: 'Optimize',
    description: 'Measure, identify friction, and continuously improve how work gets done.',
    purpose: 'Keep the system honest as conditions change.',
    action: 'Measure, identify friction, and continuously improve how work gets done.',
    output: 'A system that keeps getting better, not just built once.',
  },
  {
    step: 'Transform',
    description: 'Connect people, processes, technology, and leadership to move the organization forward.',
    purpose: 'Turn isolated fixes into lasting change.',
    action: 'Connect people, processes, technology, and leadership.',
    output: 'An organization that moves forward, not just a finished project.',
  },
];

export type SpeakingTopic = {
  title: string;
  description: string;
};

// PROVISIONAL — topics Milad could speak or write about, derived from the
// confirmed practice areas and systems work. Not a record of any past
// engagement — no speaking history is claimed.
export const SPEAKING_TOPICS: SpeakingTopic[] = [
  {
    title: 'Building practical business systems',
    description: 'What it actually takes to turn a manual process into a system people trust.',
  },
  {
    title: 'Making operations visible',
    description: 'Why most operational problems are visibility problems first.',
  },
  {
    title: 'Process improvement',
    description: 'Finding friction before proposing a fix.',
  },
  {
    title: 'Productivity as a system',
    description: 'Treating personal and team productivity as something designed, not willed.',
  },
  {
    title: 'AI in real work',
    description: 'Where AI tools change an outcome versus where they’re just novel.',
  },
  {
    title: 'Marketing systems',
    description: 'Connecting content and lead generation to a process, not just a campaign.',
  },
  {
    title: 'From fragmented work to structured operations',
    description: 'The path from ad hoc effort to a system that scales past one person.',
  },
];

/**
 * Structured data for /cv. CONFIRMED from the CV, with DOB, marital status,
 * nationality, and phone number permanently excluded per the project's
 * privacy rule (see content-status.md and master-profile.md).
 */
export const CV = {
  summary:
    'Operations Manager with over 9 years of experience in business operations, leadership, marketing, and organizational development, focused on building systems, improving performance, and driving sustainable growth.',
  skills: [
    { category: 'Business / Operations', skill: 'Business Operations & Process Optimization' },
    { category: 'Business / Operations', skill: 'Operations Management & Strategic Planning' },
    { category: 'Project Coordination', skill: 'Project Coordination & Performance Management' },
    { category: 'Leadership', skill: 'Leadership & Cross-Functional Collaboration' },
    { category: 'Marketing', skill: 'Marketing Strategy & Business Development' },
    { category: 'AI / Digital Transformation', skill: 'AI Tools, Automation & Digital Transformation' },
    { category: 'Systems / Process', skill: 'KPI Development & Data-Driven Decision Making' },
  ],
  education: [
    {
      institution: 'Islamic Azad University',
      program: 'Bachelor of Engineering, Civil Engineering',
      location: 'Mashhad, Iran',
      period: '2025 – 2027',
    },
  ],
  certifications: [
    'International certifications in Marketing, Sales, and Strategy',
    'Fundamentals of Coaching — aligned with ICF ACC-level competencies',
    '10+ additional technical and professional certifications across civil engineering, architecture, computer science, content creation, and digital communication',
  ],
  languages: [
    { language: 'Persian', level: 'Mother tongue' },
    { language: 'English', level: 'Fluent' },
    { language: 'Arabic', level: 'Basic' },
  ],
} as const;

/**
 * Central, editable copy block for the homepage. Every value here is
 * PROVISIONAL positioning/copy unless the field comment says otherwise —
 * see content-status.md for the full breakdown. Kept in one object so it's
 * easy to find and revise without touching component code. Restructured
 * for the Phase 3 eight-section homepage (Hero → Five Areas → Method →
 * Selected Work → Proof → Contents → Books → Final CTA) — the homepage is
 * deliberately NOT the full resume; /resume carries the complete archive.
 */
export const HOME = {
  hero: {
    eyebrow: 'Business Operations · Systems · Strategy',
    // Rendered as four explicit lines (Hero.astro splits on \n) — the
    // approved editorial stanza break, not just a natural text wrap.
    headline: 'I build the systems\nthat move\norganizations\nforward.',
    subhead:
      'From operational structure and business processes to productivity, AI, and growth, I design practical systems that help organizations work better.',
    note: 'A working practice, documented as it happens — not an agency, not a portfolio site.',
    // Phase 10 §05 — Contact is the sitewide primary action; Work is the
    // secondary one. Resume drops out of the Hero's two-button row (it's
    // already one click away in the nav on every page, and is the primary
    // action lower down on /resume itself) rather than competing with Work
    // for the secondary slot.
    primaryCta: 'Work With Me',
    secondaryCta: 'Explore My Work',
  },
  idea: {
    kicker: 'The idea',
    heading: 'Every organization is made of systems.',
    body: 'People, processes, information, decisions, tools — that’s what an organization actually runs on. When those systems are unclear, work slows down and fragments: the same question gets asked twice, the same delay repeats, nobody quite owns the fix. The work here starts with understanding how an organization actually works, then rebuilding the specific parts that create friction.',
  },
  systemMap: {
    kicker: 'The map',
    heading: 'One practice, six disciplines.',
    body: 'Not six separate services — six lenses on the same underlying work, applied together depending on what a given system actually needs.',
  },
  areas: {
    kicker: 'Areas of practice',
    heading: 'Five lenses I use to improve how organizations work.',
  },
  method: {
    kicker: 'The Milad Method',
    heading: 'The Milad Method',
    intro: 'I don’t start by adding more tools. I start by understanding how the organization actually works.',
    note: 'This is a personal working framework — how I approach organizational improvement, not an academically validated or certified methodology.',
  },
  selectedWork: {
    kicker: 'Selected work',
    heading: 'Systems built to solve real operational problems.',
    note: 'Every system below was designed and built firsthand. Where a measurable result exists, it’s shown. Where it doesn’t yet, that’s stated directly — nothing here is invented.',
  },
  proof: {
    kicker: 'Proof of work',
    heading: 'Proof of work.',
    note: 'Selected results reported in my professional experience. Not all figures are attributable to the systems shown above.',
  },
  // Still used on /resume (Career history, Selected achievements) even
  // though the homepage no longer renders the full timeline directly.
  career: {
    kicker: 'Career',
    heading: 'From education, into marketing, into operations.',
  },
  results: {
    kicker: 'Results',
    heading: 'Measurable results, as stated on the CV.',
    note: 'These figures come directly from the CV and describe marketing performance during specific roles. They are not claimed as outcomes of the systems work above — no evidence connects the two, so they’re kept separate.',
  },
  contentsPreview: {
    kicker: 'Contents',
    heading: 'Ideas, frameworks, and things I’m building.',
    cta: 'Explore Contents',
  },
  books: {
    kicker: 'Books',
    heading: 'Three books, across a decade, on time, balance, and self-coaching.',
  },
  finalCta: {
    heading: 'Let’s build something that works better.',
    body: 'If you’re building something, fixing something, or trying to make the work work better — let’s talk.',
    primaryCta: 'Work With Me',
    secondaryCta: 'View Resume',
  },
  speaking: {
    kicker: 'Speaking',
    heading: 'Topics I speak and write about.',
    note: 'No past speaking engagements are claimed here — these are subjects open for conversation, talks, or writing.',
  },
} as const;

/**
 * Homepage "Proof" stat trio — CONFIRMED from the CV/case-study evidence
 * (9+ years stated on the CV; 5 systems and 3 books both count real,
 * published entries in their respective content collections).
 */
export const PROOF_STATS = [
  { value: '9+', label: 'Years experience' },
  { value: '5', label: 'Systems built' },
  { value: '3', label: 'Books' },
] as const;
