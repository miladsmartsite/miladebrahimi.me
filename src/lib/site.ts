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
  // PROVISIONAL — strategic direction, not a finalized tagline.
  positioning: 'Building better ways for businesses to work.',
  url: 'https://miladebrahimi.me',
  // CONFIRMED BY MILAD — the public contact address. Do not use any other
  // email address found in the CV or project files.
  contactEmail: 'miladsmartsite@gmail.com',
  // CONFIRMED BY MILAD — current CV destination. External (Google Drive)
  // for now; every "Download CV" button reads from this one constant, so
  // swapping to a local PDF later (e.g. "/cv/milad-ebrahimi-cv.pdf") never
  // requires touching a component.
  cvUrl: 'https://drive.google.com/file/d/1Y1vseED44YG041s-mfOT-2QBprFe92nq/view?usp=drive_link',
  // Used as the fallback SEO description when a page doesn't define its own.
  defaultDescription:
    'Milad Ebrahimi — an operator who builds the systems behind how businesses run: operations, process, marketing, and applied AI, working together rather than as separate services.',
  locale: 'en',
} as const;

export type NavItem = {
  label: string;
  href: string;
};

// "Work" points at the case-study listing (src/pages/projects/) and "Ideas"
// at the writing listing (src/pages/articles/) — the underlying routes and
// content collections keep their original names; only the nav labels map
// onto the six-item structure requested for the brand site. /work (the
// experience timeline) and /cv and /resources still exist and are reachable
// directly — they're just not in the primary nav.
export const NAV_ITEMS: NavItem[] = [
  { label: 'About', href: '/about' },
  { label: 'Work', href: '/projects' },
  { label: 'Ideas', href: '/articles' },
  { label: 'Books', href: '/books' },
  { label: 'Speaking', href: '/speaking' },
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

export type PracticeArea = {
  title: string;
  description: string;
  /** How confidently this can be claimed, given current evidence. */
  standing: 'Practice' | 'Experience' | 'Focus';
};

/**
 * The seven positioning areas, presented editorially (an indexed list) on
 * the homepage rather than as service cards. `standing` avoids overclaiming
 * "expertise" across the board — see content-brief.md §5 for the framing
 * rationale. This is a PROVISIONAL framing decision, not a final one.
 */
export const PRACTICE_AREAS: PracticeArea[] = [
  {
    title: 'Operations',
    standing: 'Practice',
    description:
      'The day-to-day mechanics that keep a business running — and the discipline of making them run better. Current, hands-on work.',
  },
  {
    title: 'Business Systems',
    standing: 'Practice',
    description:
      'The tools, workflows, and data structures a business depends on, designed to scale without breaking. Five real systems built to date.',
  },
  {
    title: 'Process Improvement',
    standing: 'Practice',
    description: 'Finding where work slows down or breaks, and redesigning it so it doesn’t.',
  },
  {
    title: 'Marketing & Growth',
    standing: 'Experience',
    description:
      'Content, lead capture, and campaign work across three roles — the discipline that preceded and now runs alongside the operations practice.',
  },
  {
    title: 'Productivity',
    standing: 'Focus',
    description:
      'Systems for individuals and teams to do focused, high-quality work — the subject of three published books, and a recurring thread through the operations work itself.',
  },
  {
    title: 'AI & Digital Transformation',
    standing: 'Focus',
    description:
      'Applying new tools deliberately — where they change outcomes, not just where they’re fashionable. An active interest, applied where it earns its place.',
  },
  {
    title: 'Construction / Real Estate Operations',
    standing: 'Experience',
    description:
      'Operational systems built inside a real construction/property portfolio — reporting, material requests, and site-level process.',
  },
];

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

export type CareerStop = {
  organization: string;
  roleSummary: string;
  period: string;
  location: string;
};

/**
 * Condensed, organization-level career timeline for the homepage — the full
 * role-by-role detail (including sub-roles and exact dates) lives in the
 * `experience` content collection and renders on /work. CONFIRMED from CV.
 */
export const CAREER: CareerStop[] = [
  {
    organization: 'Milad Ebrahimi Academy',
    roleSummary: 'Education Professional (Self-employed)',
    period: '2013 – 2019',
    location: 'Mashhad, Iran',
  },
  {
    organization: 'SKYLAND Holding',
    roleSummary: 'Digital Marketing Specialist → Digital Marketing Manager',
    period: '2023 – 2024',
    location: 'Muscat, Oman',
  },
  {
    organization: 'Noor AlYaghoot Dovali',
    roleSummary: 'Marketing Communications Manager',
    period: '2024 – 2025',
    location: 'Muscat, Oman',
  },
  {
    organization: 'Perla Engineering',
    roleSummary: 'Marketing Manager → Operations Manager',
    period: '2025 – Present',
    location: 'Muscat, Oman',
  },
  {
    organization: 'Tathmeer Properties',
    roleSummary: 'Business Operations Manager (Trial)',
    period: '2026 – Present',
    location: 'Muscat, Oman',
  },
];

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
};

// PROVISIONAL — an original framing for how the work actually proceeds,
// written for the site rather than quoted from any source.
export const HOW_I_WORK: ProcessStep[] = [
  { step: 'Observe', description: 'Watch how the work actually happens — not how the org chart says it should.' },
  { step: 'Map', description: 'Trace the real flow of people, information, and decisions, and find where it breaks.' },
  { step: 'Design', description: 'Design the smallest system that removes the friction — not the most impressive one.' },
  { step: 'Build', description: 'Build it with tools the team already trusts, so adoption isn’t a second project.' },
  { step: 'Improve', description: 'Treat the first version as a draft. Systems get better by being used, not by being finished.' },
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
 * easy to find and revise without touching component code.
 */
export const HOME = {
  hero: {
    eyebrow: 'Business Operations · Systems · Strategy',
    headline: 'I build the systems that make businesses work.',
    subhead:
      'An operator working at the intersection of operations, business systems, process improvement, marketing, and applied AI — not as separate services, but as one continuous practice.',
    note: 'A working practice, documented as it happens — not an agency, not a portfolio site.',
    primaryCta: 'Explore My Work',
    secondaryCta: 'Download CV',
  },
  idea: {
    kicker: 'The idea',
    heading: 'Every business is made of systems.',
    body: 'People, processes, information, decisions, tools — that’s what a business actually runs on. When those systems are unclear, work slows down and fragments: the same question gets asked twice, the same delay repeats, nobody quite owns the fix. The work here starts with understanding how a business actually runs, then rebuilding the specific parts that create friction.',
  },
  systemMap: {
    kicker: 'The map',
    heading: 'One practice, six disciplines.',
    body: 'Not six separate services — six lenses on the same underlying work, applied together depending on what a given system actually needs.',
  },
  systems: {
    kicker: 'Systems I’ve built',
    heading: 'Five real systems, built to solve a specific operational problem.',
    note: 'Every system below was designed and built firsthand. Where a measurable result exists, it’s shown. Where it doesn’t yet, that’s stated directly — nothing here is invented.',
  },
  process: {
    kicker: 'How I work',
    heading: 'The same method, every time.',
  },
  areas: {
    kicker: 'Areas of practice',
    heading: 'Seven lenses on the same underlying problem.',
  },
  // PROVISIONAL — a positioning statement in the site's own voice, not a
  // quote from any source. Used as a QuoteBlock visual break on the
  // homepage between Career and Results.
  manifesto: 'Systems don’t need to be complicated to work. They need to be used.',
  career: {
    kicker: 'Career',
    heading: 'From education, into marketing, into operations.',
  },
  results: {
    kicker: 'Results',
    heading: 'Measurable results, as stated on the CV.',
    note: 'These figures come directly from the CV and describe marketing performance during specific roles. They are not claimed as outcomes of the systems work above — no evidence connects the two, so they’re kept separate.',
  },
  ideas: {
    kicker: 'Ideas',
    heading: 'Writing in progress — on operations, systems, and where AI actually helps.',
    note: 'Nothing below is a finished, published piece yet — these are the topics currently being written.',
  },
  books: {
    kicker: 'Books',
    heading: 'Three books, across a decade, on time, balance, and self-coaching.',
  },
  about: {
    kicker: 'A note',
    body: 'This site is a working home base more than a highlight reel — a place to track real systems as they’re built, and to think in public about operations, process, and the tools reshaping both.',
    cta: 'More about the background →',
  },
  speaking: {
    kicker: 'Speaking',
    heading: 'Topics I speak and write about.',
    note: 'No past speaking engagements are claimed here — these are subjects open for conversation, talks, or writing.',
  },
  finalCta: {
    heading: 'If you’re building something, fixing something, or trying to make the work work better — let’s talk.',
    body: 'A short note is enough to start.',
  },
} as const;
