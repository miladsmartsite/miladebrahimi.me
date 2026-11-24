import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isPublishedAt, normalizePublishDate, parsePublishDate, findPublishDateProblem } from '../src/lib/publication.ts';

const NOW = new Date('2026-10-01T12:00:00Z');
const at = (iso: string, extra: { draft?: boolean; placeholder?: boolean } = {}) => ({
  publishDate: parsePublishDate(iso),
  ...extra,
});
const iso = (value: string) => parsePublishDate(value).toISOString();
const isInvalid = (value: unknown) => Number.isNaN((parsePublishDate(value) as Date).getTime());

/* ── The publication rule ─────────────────────────────────────────────── */

test('a valid date in the past is published', () => {
  assert.equal(isPublishedAt(at('2026-09-09T10:00:00Z'), NOW), true);
});

test('a valid date in the future is not published', () => {
  assert.equal(isPublishedAt(at('2026-10-02T08:00:00Z'), NOW), false);
  assert.equal(isPublishedAt(at('2099-01-01'), NOW), false);
});

test('a date exactly at the evaluation time is published; one millisecond later is not', () => {
  assert.equal(isPublishedAt(at('2026-10-01T12:00:00Z'), NOW), true);
  assert.equal(isPublishedAt({ publishDate: new Date(NOW.getTime() + 1) }, NOW), false);
});

test('a future article becomes published once the clock reaches it', () => {
  const entry = at('2026-10-02T08:00:00Z');
  assert.equal(isPublishedAt(entry, new Date('2026-10-02T07:59:59Z')), false);
  assert.equal(isPublishedAt(entry, new Date('2026-10-02T08:00:00Z')), true);
  assert.equal(isPublishedAt(entry, new Date('2026-10-02T09:17:00Z')), true);
});

test('draft and placeholder entries are never published, even when due', () => {
  assert.equal(isPublishedAt(at('2026-01-01T00:00:00Z', { draft: true }), NOW), false);
  assert.equal(isPublishedAt(at('2026-01-01T00:00:00Z', { placeholder: true }), NOW), false);
  assert.equal(isPublishedAt(at('2026-01-01T00:00:00Z', { draft: false, placeholder: false }), NOW), true);
});

test('an invalid or missing date is never published', () => {
  assert.equal(isPublishedAt({ publishDate: new Date('not a date') }, NOW), false);
  assert.equal(isPublishedAt({ publishDate: undefined as unknown as Date }, NOW), false);
  assert.equal(isPublishedAt({ publishDate: parsePublishDate('2026-02-31') }, NOW), false);
  assert.equal(isPublishedAt(at('2026-01-01T00:00:00Z'), new Date(NaN)), false);
});

/* ── Supported formats, always UTC ────────────────────────────────────── */

test('date-only and zone-less datetimes are read as UTC, never as local time', () => {
  assert.equal(iso('2026-09-24'), '2026-09-24T00:00:00.000Z');
  assert.equal(iso('2026-09-09T10:00'), '2026-09-09T10:00:00.000Z');
  assert.equal(iso('2026-09-09T10:00:00'), '2026-09-09T10:00:00.000Z');
  assert.equal(iso('2026-09-09 10:00'), '2026-09-09T10:00:00.000Z');
  assert.equal(iso('  2026-09-09T10:00:00  '), '2026-09-09T10:00:00.000Z');
});

test('Z and ±HH:MM offsets are honoured', () => {
  assert.equal(iso('2026-09-09T10:00:00Z'), '2026-09-09T10:00:00.000Z');
  assert.equal(iso('2026-09-09T10:00:00+04:00'), '2026-09-09T06:00:00.000Z');
  assert.equal(iso('2026-09-09T10:00:00-05:30'), '2026-09-09T15:30:00.000Z');
  assert.equal(iso('2026-09-09T10:00:00+14:00'), '2026-09-08T20:00:00.000Z');
  assert.equal(iso('2026-09-09T10:00:00-12:00'), '2026-09-09T22:00:00.000Z');
});

test('fractional seconds are supported', () => {
  assert.equal(iso('2026-09-09T10:00:00.5Z'), '2026-09-09T10:00:00.500Z');
  assert.equal(iso('2026-09-09T10:00:00.123456Z'), '2026-09-09T10:00:00.123Z');
});

test('leap days are valid only in leap years', () => {
  assert.equal(iso('2028-02-29'), '2028-02-29T00:00:00.000Z');
  assert.equal(isInvalid('2027-02-29'), true);
  assert.equal(isInvalid('2100-02-29'), true);
  assert.equal(iso('2000-02-29'), '2000-02-29T00:00:00.000Z');
});

/* ── Rejected: impossible calendar dates ──────────────────────────────── */

test('impossible calendar dates are rejected', () => {
  for (const bad of ['2026-02-31', '2026-02-30', '2026-04-31', '2026-06-31', '2026-13-01', '2026-00-10', '2026-01-00', '2026-01-32']) {
    assert.equal(isInvalid(bad), true, bad);
    assert.equal(isInvalid(`${bad}T10:00:00`), true, `${bad}T10:00:00`);
  }
});

/* ── Rejected: invalid times and timezone offsets ─────────────────────── */

test('invalid hours, minutes and seconds are rejected', () => {
  for (const bad of ['2026-11-03T24:00:00', '2026-11-03T25:00', '2026-11-03T10:60', '2026-11-03T10:00:60', '2026-11-03T99:99:99']) {
    assert.equal(isInvalid(bad), true, bad);
  }
});

test('invalid timezone offsets are rejected', () => {
  for (const bad of [
    '2026-11-03T08:00:00+0400', // no colon
    '2026-11-03T08:00:00+04', // hours only
    '2026-11-03T08:00:00+4:00', // one-digit hour
    '2026-11-03T08:00:00+25:00', // beyond +14
    '2026-11-03T08:00:00+15:00',
    '2026-11-03T08:00:00+14:30', // +14:00 is the maximum
    '2026-11-03T08:00:00+04:60', // minutes out of range
    '2026-11-03T08:00:00UTC',
    '2026-11-03T08:00:00 GMT+4',
    '2026-11-03T08:00:00z',
    '2026-11-03T08:00:00Z+04:00',
    '2026-11-03T08:00:00 +04:00',
  ]) {
    assert.equal(isInvalid(bad), true, bad);
  }
  assert.equal(isInvalid('2026-11-03Z'), true); // an offset needs a time part
});

/* ── Rejected: ambiguous or free-form strings ─────────────────────────── */

test('ambiguous and free-form date strings are rejected instead of guessed', () => {
  for (const bad of [
    '11/03/2026', // 3 Nov or 11 Mar?
    '03/11/2026',
    '2026/11/03',
    'Nov 3 2026',
    '3 November 2026',
    'November 3, 2026',
    '20261103',
    '2026-11-3', // not zero-padded
    '2026-1-03',
    '26-11-03',
    'today',
    'tomorrow',
    '2026-11-03T',
    '2026-11-03T10',
    '2026-11-03T10:00:00.',
    '2026-11-03T10:00.5', // fraction without seconds
  ]) {
    assert.equal(isInvalid(bad), true, bad);
  }
});

test('missing, empty and non-string values become an invalid date', () => {
  for (const bad of [null, undefined, '', '   ', 0, 2026, true, {}, []]) {
    assert.equal(isInvalid(bad), true, JSON.stringify(bad));
    const out = normalizePublishDate(bad);
    assert.ok(out instanceof Date && Number.isNaN(out.getTime()), `normalize: ${JSON.stringify(bad)}`);
  }
});

test('Date objects from the YAML parser pass through the schema pre-processor untouched', () => {
  const d = new Date('2026-09-09T10:00:00Z');
  assert.equal(normalizePublishDate(d), d);
});

/* ── Raw frontmatter, before YAML parsing ─────────────────────────────── */

const file = (line: string) => `---\ntitle: "T"\n${line}\ncategory: "Operations"\n---\n\nBody\n`;

test('raw check: an unquoted impossible date that YAML would silently normalise is caught', () => {
  // js-yaml turns these into 3 March 2026 / 1 January 2027 without complaint.
  for (const bad of ['publishDate: 2026-02-31', 'publishDate: 2026-13-01', 'publishDate: 2026-02-30T10:00:00']) {
    const problem = findPublishDateProblem(file(bad));
    assert.ok(problem, bad);
    assert.match(problem!, /not a valid date/);
  }
});

test('raw check: quoted bad values, bad offsets and ambiguous strings are caught', () => {
  for (const bad of [
    'publishDate: "2026-02-31"',
    "publishDate: '2026-02-31T10:00'",
    'publishDate: "11/03/2026"',
    'publishDate: Nov 3 2026',
    'publishDate: 2026-11-03T08:00:00+0400',
    'publishDate: 2026-11-03T24:00:00',
    'publishDate: >-',
  ]) {
    assert.ok(findPublishDateProblem(file(bad)), bad);
  }
  assert.match(findPublishDateProblem(file('publishDate:'))!, /empty/);
  assert.match(findPublishDateProblem(file('publishDate: ""'))!, /empty/);
});

test('raw check: valid values pass, quoted or not, with comments and CRLF line endings', () => {
  for (const ok of [
    'publishDate: 2026-09-24',
    'publishDate: 2026-09-09T10:00:00',
    'publishDate: "2026-09-09T10:00:00"',
    "publishDate: '2026-09-09 10:00'",
    'publishDate: 2026-09-09T10:00:00+04:00',
    'publishDate: 2026-09-09T10:00:00Z   # scheduled for the morning',
    'publishDate:    2028-02-29',
  ]) {
    assert.equal(findPublishDateProblem(file(ok)), null, ok);
  }
  assert.equal(findPublishDateProblem(file('publishDate: 2026-09-24').replace(/\n/g, '\r\n')), null);
});

test('raw check: a file without frontmatter or without publishDate is left to the schema', () => {
  assert.equal(findPublishDateProblem('# just a heading\n'), null);
  assert.equal(findPublishDateProblem('---\ntitle: "T"\n---\nBody\n'), null);
});

test('every real article in the repository has a valid raw publishDate', () => {
  const dir = join(import.meta.dirname, '..', 'src', 'content', 'articles');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  assert.ok(files.length > 0);
  for (const f of files) {
    assert.equal(findPublishDateProblem(readFileSync(join(dir, f), 'utf8')), null, f);
  }
});
