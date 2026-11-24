/**
 * The site's single publication rule, kept free of framework imports so it
 * can be unit-tested with plain Node (see tests/publication.test.ts) and
 * imported by astro.config.mjs.
 *
 * An entry is public only when ALL of these hold:
 *   - `draft` is not true,
 *   - `placeholder` is not true,
 *   - `publishDate` is a valid instant that is <= the evaluation time.
 *
 * Anything else — including an invalid or missing date — is NOT public.
 *
 * Time model: the site is static, so "now" is the moment of the build. A
 * scheduled article goes live on the first build that runs at or after its
 * `publishDate` (see .github/workflows/main.yml for the build schedule).
 *
 * Date model: `publishDate` is read in UTC and only a small set of explicit
 * ISO 8601 shapes is supported (see parsePublishDate). Everything else is
 * rejected rather than guessed at, so the same file means the same instant
 * on every machine.
 */

export interface Publishable {
  draft?: boolean;
  placeholder?: boolean;
  publishDate: Date;
}

export function isPublishedAt(entry: Publishable, now: Date): boolean {
  if (entry.draft === true || entry.placeholder === true) return false;
  const publishedAt = entry.publishDate instanceof Date ? entry.publishDate.getTime() : NaN;
  const evaluatedAt = now instanceof Date ? now.getTime() : NaN;
  if (!Number.isFinite(publishedAt) || !Number.isFinite(evaluatedAt)) return false;
  return publishedAt <= evaluatedAt;
}

/**
 * The only supported shapes (text is trimmed first):
 *
 *   YYYY-MM-DD                         date only            -> 00:00:00 UTC
 *   YYYY-MM-DDTHH:MM[:SS[.fff]]        date and time        -> read as UTC
 *   YYYY-MM-DD HH:MM[:SS[.fff]]        same, space instead of "T"
 *   ...followed by Z or ±HH:MM         explicit offset      -> honoured
 *
 * Rejected (returns an Invalid Date): every other shape — "Nov 3 2026",
 * "11/03/2026", "2026/11/03", "20261103", "2026-11-3", offsets without a
 * colon ("+0400") or with a name ("UTC", "GMT+4"); impossible calendar dates
 * ("2026-02-31", "2027-02-29"); hour 24 or above, minute or second 60 or
 * above; offsets beyond ±14:00 or with minutes above 59.
 *
 * Rejecting instead of guessing matters because `new Date("11/03/2026")` is
 * read in the build machine's local zone and as month-first — different
 * answers on a laptop and on a CI runner.
 */
const ISO_SHAPE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})?)?$/;

export function parsePublishDate(value: unknown): Date {
  const invalid = () => new Date(NaN);
  if (typeof value !== 'string') return invalid();
  const match = ISO_SHAPE.exec(value.trim());
  if (!match) return invalid();

  const [, y, mo, d, h = '00', mi = '00', s = '00', fraction = '', zone] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);

  if (month < 1 || month > 12) return invalid();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return invalid();
  if (hour > 23 || minute > 59 || second > 59) return invalid();

  let offsetMinutes = 0;
  if (zone && zone !== 'Z') {
    const sign = zone[0] === '-' ? -1 : 1;
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMins = Number(zone.slice(4, 6));
    if (offsetHours > 14 || offsetMins > 59) return invalid();
    if (offsetHours === 14 && offsetMins > 0) return invalid();
    offsetMinutes = sign * (offsetHours * 60 + offsetMins);
  }

  const millis = fraction ? Number(fraction.padEnd(3, '0').slice(0, 3)) : 0;
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, millis) - offsetMinutes * 60_000;
  return new Date(utc);
}

/**
 * Schema pre-processor for `publishDate`. A Date handed over by the YAML
 * parser passes through (its raw text is checked separately — see
 * findPublishDateProblem — because YAML has already normalised it by now);
 * a string must be one of the supported shapes; anything else (null, empty,
 * numbers, booleans) becomes an Invalid Date, which the schema rejects.
 */
export function normalizePublishDate(value: unknown): Date {
  if (value instanceof Date) return value;
  return parsePublishDate(value);
}

/**
 * Checks the RAW `publishDate:` line of a Markdown file's frontmatter,
 * before YAML parsing. Needed because YAML silently "fixes" some unquoted
 * dates (`2026-02-31` becomes 3 March, `2026-13-01` becomes 1 January 2027)
 * before the content schema ever sees them.
 *
 * Returns a human-readable problem, or null when the line is fine. A file
 * with no `publishDate` line at all returns null here — the schema already
 * fails the build for a missing required field.
 */
export function findPublishDateProblem(fileText: string): string | null {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fileText);
  if (!frontmatter) return null;
  const line = /^publishDate:[ \t]*(.*)$/m.exec(frontmatter[1]);
  if (!line) return null;

  let raw = line[1].replace(/\r$/, '').trim();
  // Drop a trailing YAML comment (` # note`), but only outside quotes.
  if (!/^["']/.test(raw)) raw = raw.replace(/\s+#.*$/, '').trim();
  const quote = /^(["'])(.*)\1$/.exec(raw);
  const text = quote ? quote[2] : raw;

  if (text === '') return 'publishDate is empty';
  if (Number.isNaN(parsePublishDate(text).getTime())) {
    return `publishDate "${text}" is not a valid date in a supported format (YYYY-MM-DD, or YYYY-MM-DDTHH:MM[:SS] with an optional Z or ±HH:MM offset; read as UTC)`;
  }
  return null;
}
