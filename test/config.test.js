import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  MAX_POLL_FREQUENCY,
  MIN_POLL_FREQUENCY,
  normalizeConfig,
} from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('normalizeConfig trims the credentials', () => {
  const config = normalizeConfig({ client_id: ' id ', client_secret: ' secret\n' });
  assert.equal(config.client_id, 'id');
  assert.equal(config.client_secret, 'secret');
});

test('normalizeConfig coerces and bounds the refresh interval', () => {
  assert.equal(normalizeConfig({ poll_frequency: '300' }).poll_frequency, 300);
  assert.equal(normalizeConfig({ poll_frequency: 5 }).poll_frequency, MIN_POLL_FREQUENCY);
  assert.equal(normalizeConfig({ poll_frequency: 99999 }).poll_frequency, MAX_POLL_FREQUENCY);
  assert.equal(normalizeConfig({ poll_frequency: 'abc' }).poll_frequency, 120);
});
