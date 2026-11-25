import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMeCoachLaunched, ME_COACH_LAUNCH } from '../src/lib/site.ts';

test('the ME.Coach launch section switches on exactly at the launch moment (Muscat time)', () => {
  const launch = new Date(ME_COACH_LAUNCH.date).getTime();
  assert.equal(isMeCoachLaunched(new Date(launch - 1)), false);
  assert.equal(isMeCoachLaunched(new Date(launch)), true);
  assert.equal(isMeCoachLaunched(new Date(launch + 60_000)), true);
});

test('launch is 1 January 2027 at midnight in Muscat, i.e. 20:00 UTC on 31 December', () => {
  assert.equal(new Date(ME_COACH_LAUNCH.date).toISOString(), '2026-12-31T20:00:00.000Z');
  assert.equal(isMeCoachLaunched(new Date('2026-12-31T19:59:59Z')), false);
  assert.equal(isMeCoachLaunched(new Date('2026-12-31T20:17:00Z')), true);
});
