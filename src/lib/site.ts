/**
 * Single source of truth for brand, navigation and site-wide copy.
 *
 * Brand: "Milad Style", shared with the YouTube channel, the /start page and
 * the free worksheet (ME Studio brand/BRAND.md). Facts: only items marked ✅
 * in ME Studio books/bio-facts.md, plus what Milad has confirmed for this
 * site. Anything not yet confirmed is left out, never guessed.
 */

export const SITE = {
  name: 'Milad Ebrahimi',
  brandName: 'MILAD EBRAHIMI',
  // The brand tagline. It names the three books: Time Engineering,
  // Self-Coaching (Blueprint) and The Balance.
  tagline: 'Engineer your time. Coach yourself. Live in balance.',
  positioning: 'Productivity coach, author and international trainer. Founder of ME Academy.',
  homeTitle: 'Milad Ebrahimi · Engineer your time. Coach yourself. Live in balance.',
  url: 'https://miladebrahimi.me',
  // CONFIRMED BY MILAD: the public contact address.
  contactEmail: 'miladsmartsite@gmail.com',
  cvUrl: 'https://drive.google.com/file/d/1Y1vseED44YG041s-mfOT-2QBprFe92nq/view?usp=drive_link',
  defaultDescription:
    'Milad Ebrahimi is a productivity coach and author. One practical idea a day from his books on time engineering, self-coaching and balance, plus a free Balance Wheel worksheet.',
  jobTitle: 'Productivity coach and author',
  defaultOgImage: '/images/og/default.png',
  locale: 'en',
} as const;

export const PERSON_ID = `${SITE.url}/#person`;

/** The three pillars. The same words as the YouTube kicker line. */
export const PILLARS = [
  {
    key: 'time-engineering',
    title: 'Time Engineering',
    line: 'Plan the day around a few important tasks, not a long list.',
  },
  {
    key: 'self-coaching',
    title: 'Self-Coaching',
    line: 'Lead yourself with the right questions, 40 days at a time.',
  },
  {
    key: 'balance',
    title: 'Balance',
    line: 'Score eight areas of life and choose the one that matters now.',
  },
] as const;

/**
 * Article topics: the three pillars plus Business, for the operations,
 * marketing and AI writing that comes from Milad's work inside companies.
 * The schema in content.config.ts reads this list, so a typo fails the build.
 */
export const TOPICS = [
  { title: 'Time Engineering', slug: 'time-engineering', line: 'Plan, prioritise and protect your time.' },
  { title: 'Self-Coaching', slug: 'self-coaching', line: 'Goals, questions and the 40-day cycle.' },
  { title: 'Balance', slug: 'balance', line: 'The eight areas of life, and choosing one.' },
  { title: 'Business', slug: 'business', line: 'Systems, operations, marketing and AI at work.' },
] as const;

export type NavItem = { label: string; href: string };

export const NAV_ITEMS: NavItem[] = [
  { label: 'Start here', href: '/start/' },
  { label: 'Videos', href: '/videos/' },
  { label: 'Ideas', href: '/ideas/' },
  { label: 'Books', href: '/books/' },
  { label: 'Coaching', href: '/coaching/' },
  { label: 'About', href: '/about/' },
];

export const YOUTUBE = {
  channelId: 'UCc8az1ZBfLbzzX7tfrkf56Q',
  handle: '@miladebrahimi_intl',
  url: 'https://www.youtube.com/@miladebrahimi_intl',
  subscribeUrl: 'https://www.youtube.com/@miladebrahimi_intl?sub_confirmation=1',
  series: 'Time Engineering in 30 Seconds',
  // Only videos from the current channel (since the November 2026 relaunch)
  // are shown; older uploads are a different, archived direction.
  since: '2026-11-01',
  // Archived, unrelated uploads that may still be public. Never shown.
  hidden: ['TWAsVXrsWb8', 'E1xJHMWGfas', 'wSBkkV9CPy4', 'p8F3NkFxdYo', 'CGOHEHOmqrQ'],
} as const;

export type SocialLink = { label: string; href: string };

// CONFIRMED BY MILAD.
export const SOCIAL_LINKS: SocialLink[] = [
  { label: 'YouTube', href: YOUTUBE.url },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/miladebrahimi-me' },
];

/**
 * Email signup. Leave `action` empty until an email service is connected:
 * the site then never shows a form that goes nowhere. /start gives the
 * worksheet directly, and every "newsletter" call to action points there.
 * To connect a service, paste its embedded-form POST URL into `action` and
 * the name of its email field into `emailField` (plus any required hidden
 * fields). Every signup form on the site reads from here.
 */
export const NEWSLETTER = {
  name: 'One idea a week',
  promise: 'One practical idea from my books every Sunday. Five minutes to read. Unsubscribe any time.',
  action: '',
  emailField: 'email',
  hiddenFields: {} as Record<string, string>,
} as const;

/** The free lead magnet. /start is ME Studio's own page on the host (not built by this site); these are links to it. */
export const WORKSHEET = {
  title: 'The Balance Wheel',
  hook: 'Rate your life in 8 numbers.',
  description: 'A free 2-page worksheet from Self-Coaching Blueprint. Score eight areas of your life, draw your wheel, then pick one area for the next 40 days.',
  a4: '/start/balance-wheel-worksheet-A4.pdf',
  letter: '/start/balance-wheel-worksheet-Letter.pdf',
  areas: ['Business', 'Finance', 'Lifestyle', 'Health', 'Relationships', 'Social', 'Mental', 'Spiritual'],
} as const;

/**
 * Store link for Self-Coaching Blueprint. Empty until Milad provides it;
 * every "buy" button is hidden while it is empty.
 */
export const BOOK_STORE_URL = '';

/**
 * The 40-Day Self-Coaching Planner (Amazon KDP, built in ME Studio). Empty
 * `url` = not on sale yet, and the site doesn't mention it at all. Paste the
 * Amazon product link here and it appears on /books and the homepage.
 */
export const PLANNER = {
  title: 'The 40-Day Self-Coaching Planner',
  description: 'A printed planner built from the tools in Self-Coaching Blueprint: your Balance Wheel, one chosen area, 40 days of morning plans and night questions.',
  url: '',
} as const;

/** ME.Coach lives at /coach as its own app; this site only links to it. */
export const ME_COACH = {
  url: '/coach/',
  name: 'ME.Coach',
  line: 'Your self-coaching app, one minute a day.',
  description: 'The tests, goals and daily follow-up from Self-Coaching Blueprint, in one app. Start with a 7-day free trial.',
} as const;

/**
 * ME.Coach launch moment (ME Family Brief: shared as a gift in the YouTube
 * video on 1 January 2027). The launch section shows on the homepage and
 * /coaching from the first build at or after `date` (the hourly build makes
 * that within the hour). `giftUrl`: the ME.Coach gift link with the code
 * Milad sets in ME.Coach Settings, e.g. '/coach/?gift=YOUTUBE'. Empty = the
 * section links to the normal 7-day trial instead.
 */
export const ME_COACH_LAUNCH = {
  date: '2027-01-01T00:00:00+04:00',
  giftUrl: '',
} as const;

/** True from the moment `ME_COACH_LAUNCH.date` is reached (build time). */
export function isMeCoachLaunched(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(ME_COACH_LAUNCH.date).getTime();
}

/** Ways to work together, shown on /coaching and the homepage. */
export const OFFERS = [
  {
    key: 'app',
    label: 'App · 7-day free trial',
    title: 'ME.Coach',
    description: 'The Balance Wheel test, 40-day goals, morning and night check-ins. One minute a day.',
    cta: 'Try ME.Coach',
    href: '/coach/',
  },
  {
    key: 'coaching',
    label: '1:1 · Limited places',
    title: 'Personal coaching',
    description: 'Monthly coaching with Milad, built on the 40-day self-coaching cycle from the book.',
    cta: 'Apply for coaching',
    href: '/coaching/#coaching',
  },
  {
    key: 'workshops',
    label: 'Teams · Muscat, the Gulf, online',
    title: 'Workshops',
    description: 'Time engineering and focus workshops for teams and companies, in person or online.',
    cta: 'Enquire about a workshop',
    href: '/coaching/#workshops',
  },
] as const;

/** Topics for /contact. */
export const CONTACT_TOPICS = [
  'Personal coaching',
  'Workshops for teams',
  'Speaking and interviews',
  'Books',
  'Collaboration',
];

/**
 * Facts shown as the homepage proof strip. Every value is ✅ in bio-facts.md
 * or a count of real published entries. "260+ events" stays out until Milad
 * confirms the current number.
 */
export const PROOF = [
  { value: '10+', label: 'Years of coaching' },
  { value: '3', label: 'Books written' },
  { value: 'ME', label: 'Academy founder' },
  { value: 'Daily', label: 'New idea on YouTube' },
] as const;

/** Copy still used by the Results block on /about/resume. */
export const HOME = {
  results: {
    kicker: 'Results',
    heading: 'Measurable results, as stated on the CV.',
    note: 'These figures come directly from the CV and describe marketing performance during specific roles.',
  },
} as const;

/* ── Professional background (/about/resume, /about/work) ─────────────── */

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
