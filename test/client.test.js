import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FlairApiError, FlairAuthError, FlairClient, FLAIR_SCOPES } from '../src/flair/client.js';
import { CREDENTIALS, createFakeFlair } from './helpers/fakeFlair.js';

const clientFor = (fake, credentials = CREDENTIALS, options = {}) =>
  new FlairClient({
    clientId: credentials.client_id,
    clientSecret: credentials.client_secret,
    fetch: fake.fetch,
    baseUrl: 'https://api.flair.test',
    ...options,
  });

test('the token is requested with the client credentials grant and reused', async () => {
  const fake = createFakeFlair();
  const client = clientFor(fake);
  await client.list('vents');
  await client.list('pucks');
  const tokenRequests = fake.requests.filter((r) => r.path === '/oauth2/token');
  assert.equal(tokenRequests.length, 1, 'one token for both requests');
  assert.equal(tokenRequests[0].body.grant_type, 'client_credentials');
  assert.equal(tokenRequests[0].body.scope, FLAIR_SCOPES.join(' '));
});

test('the token is renewed before it expires', async () => {
  const fake = createFakeFlair();
  let now = 0;
  const client = clientFor(fake, CREDENTIALS, { now: () => now });
  await client.list('vents');
  now = 3600 * 1000 - 60 * 1000; // one minute before the expiry
  await client.list('vents');
  assert.equal(fake.tokensIssued, 2);
});

test('refused credentials raise a FlairAuthError', async () => {
  const fake = createFakeFlair();
  const client = clientFor(fake, { client_id: 'x', client_secret: 'wrong' });
  await assert.rejects(client.list('vents'), FlairAuthError);
});

test('a revoked token is replaced once, then the request succeeds', async () => {
  const fake = createFakeFlair();
  const client = clientFor(fake);
  await client.list('vents');
  client.token = 'revoked';
  const vents = await client.list('vents');
  assert.equal(vents.length, 3);
  assert.equal(fake.tokensIssued, 2);
});

test('list follows the JSON:API pagination links', async () => {
  const fake = createFakeFlair({ pageSize: 2 });
  const vents = await clientFor(fake).list('vents');
  assert.deepEqual(
    vents.map((v) => v.id),
    ['v1', 'v2', 'v3'],
  );
});

test('update sends a JSON:API PATCH and resolves the updated resource', async () => {
  const fake = createFakeFlair();
  const updated = await clientFor(fake).update('vents', 'v1', { 'percent-open': 50 });
  const patch = fake.requests.find((r) => r.method === 'PATCH');
  assert.equal(patch.path, '/api/vents/v1');
  assert.deepEqual(patch.body, {
    data: { type: 'vents', attributes: { 'percent-open': 50 }, relationships: {} },
  });
  assert.equal(patch.headers['content-type'], 'application/json');
  assert.equal(updated.attributes['percent-open'], 50);
});

test('an HTTP error carries its status and the Flair detail', async () => {
  const fake = createFakeFlair();
  const client = clientFor(fake);
  await client.getToken();
  fake.failNext(422, { errors: [{ title: 'Invalid', detail: 'percent-open must be 0-100' }] });
  await assert.rejects(client.update('vents', 'v1', { 'percent-open': 500 }), (err) => {
    assert.ok(err instanceof FlairApiError);
    assert.equal(err.status, 422);
    assert.match(err.message, /percent-open must be 0-100/);
    return true;
  });
});

test('a network failure is a FlairApiError, never a crash', async () => {
  const fake = createFakeFlair();
  fake.down = true;
  await assert.rejects(clientFor(fake).list('vents'), FlairApiError);
});

test('the client secret never appears in an error message', async () => {
  const fake = createFakeFlair();
  const client = clientFor(fake, { client_id: 'x', client_secret: 'super-secret-value' });
  await assert.rejects(client.list('vents'), (err) => !err.message.includes('super-secret-value'));
});

test('parallel requests share one token request, even after a revocation', async () => {
  const fake = createFakeFlair();
  const client = clientFor(fake);
  await Promise.all(['structures', 'rooms', 'vents', 'pucks'].map((type) => client.list(type)));
  assert.equal(fake.tokensIssued, 1);
  client.token = 'revoked';
  await Promise.all(['structures', 'rooms', 'vents', 'pucks'].map((type) => client.list(type)));
  assert.equal(fake.tokensIssued, 2);
});
