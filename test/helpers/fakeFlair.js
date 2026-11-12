// -----------------------------------------------------------------------------
// An in-memory Flair cloud, answering the requests FlairClient sends through
// the `fetch` it is given. No network in the tests.
//
// `fake.data` holds the JSON:API resources by type (edit it to simulate a
// change made in the Flair app); `fake.requests` records every call;
// `fake.failNext(status)` / `fake.down = true` simulate errors.
// -----------------------------------------------------------------------------

import { FlairClient } from '../../src/flair/client.js';
import { FlairHub } from '../../src/flair/hub.js';

export const CREDENTIALS = { client_id: 'test-client', client_secret: 'test-secret' };

/** A small home: 1 structure, 2 rooms, 3 vents, 2 pucks. */
export function sampleData() {
  const rel = (type, id) => ({ data: { type, id } });
  return {
    structures: [
      {
        id: 's1',
        type: 'structures',
        attributes: { name: 'Maison', home: true, mode: 'auto', 'setup-complete': true },
        relationships: {},
      },
    ],
    rooms: [
      {
        id: 'r1',
        type: 'rooms',
        attributes: {
          name: 'Salon',
          'current-temperature-c': 20.4,
          'current-humidity': 45,
          'set-point-c': 21,
          active: true,
        },
        relationships: { structure: rel('structures', 's1') },
      },
      {
        id: 'r2',
        type: 'rooms',
        attributes: {
          name: 'Chambre',
          'current-temperature-c': null,
          'current-humidity': null,
          'set-point-c': 19,
          active: false,
        },
        relationships: { structure: rel('structures', 's1') },
      },
    ],
    vents: [
      {
        id: 'v1',
        type: 'vents',
        attributes: { name: 'Salon vent 1', 'percent-open': 100, inactive: false },
        relationships: { room: rel('rooms', 'r1') },
      },
      {
        id: 'v2',
        type: 'vents',
        attributes: { name: 'Salon vent 2', 'percent-open': 50, inactive: false },
        relationships: { room: rel('rooms', 'r1') },
      },
      {
        id: 'v3',
        type: 'vents',
        attributes: { name: 'Chambre vent', 'percent-open': 0, inactive: false },
        relationships: { room: rel('rooms', 'r2') },
      },
    ],
    pucks: [
      {
        id: 'p1',
        type: 'pucks',
        attributes: {
          name: 'Puck salon',
          'current-temperature-c': 20.4,
          'current-humidity': 45,
          inactive: false,
        },
        relationships: { room: rel('rooms', 'r1') },
      },
      {
        id: 'p2',
        type: 'pucks',
        attributes: { name: 'Puck chambre', inactive: true },
        relationships: { room: rel('rooms', 'r2') },
      },
    ],
  };
}

const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

export function createFakeFlair({ data = sampleData(), pageSize = 100 } = {}) {
  const fake = {
    data,
    requests: [],
    tokensIssued: 0,
    down: false,
    failures: [],
    failNext(status, body = {}) {
      fake.failures.push({ status, body });
    },
  };

  fake.fetch = async (url, init = {}) => {
    const { pathname, searchParams } = new URL(url);
    const method = init.method ?? 'GET';
    const body =
      init.body instanceof URLSearchParams
        ? Object.fromEntries(init.body)
        : init.body
          ? JSON.parse(init.body)
          : undefined;
    fake.requests.push({ method, path: pathname, body, headers: init.headers ?? {} });
    if (fake.down) {
      throw new Error('getaddrinfo ENOTFOUND api.flair.co');
    }
    if (fake.failures.length > 0) {
      const { status, body: failure } = fake.failures.shift();
      return json(status, failure);
    }

    if (pathname === '/oauth2/token') {
      if (
        body.client_id !== CREDENTIALS.client_id ||
        body.client_secret !== CREDENTIALS.client_secret
      ) {
        return json(401, { error: 'invalid_client' });
      }
      fake.tokensIssued += 1;
      return json(200, { access_token: `token-${fake.tokensIssued}`, expires_in: 3600 });
    }

    if (init.headers?.authorization !== `Bearer token-${fake.tokensIssued}`) {
      return json(401, { errors: [{ title: 'Unauthorized' }] });
    }

    const match = pathname.match(/^\/api\/([a-z-]+)(?:\/([^/]+))?$/);
    const list = match && fake.data[match[1]];
    if (!list) {
      return json(404, { errors: [{ title: 'Not found' }] });
    }
    if (method === 'GET' && !match[2]) {
      const page = Number(searchParams.get('page') ?? 1);
      const items = list.slice((page - 1) * pageSize, page * pageSize);
      const next = page * pageSize < list.length ? `/api/${match[1]}?page=${page + 1}` : null;
      return json(200, { data: structuredClone(items), links: { next } });
    }
    if (method === 'PATCH' && match[2]) {
      const resource = list.find((item) => item.id === decodeURIComponent(match[2]));
      if (!resource) {
        return json(404, { errors: [{ title: 'Not found' }] });
      }
      Object.assign(resource.attributes, body.data.attributes);
      return json(200, { data: structuredClone(resource) });
    }
    return json(405, { errors: [{ title: 'Method not allowed' }] });
  };

  fake.createClient = ({ clientId, clientSecret }) =>
    new FlairClient({
      clientId,
      clientSecret,
      fetch: fake.fetch,
      baseUrl: 'https://api.flair.test',
    });

  fake.createHub = () => new FlairHub({ createClient: fake.createClient });

  /** Change an attribute "in the Flair app". */
  fake.set = (type, id, attributes) => {
    Object.assign(fake.data[type].find((item) => item.id === id).attributes, attributes);
  };

  return fake;
}

/** A hub already configured and refreshed against a fake Flair. */
export async function refreshedHub(fake = createFakeFlair()) {
  const hub = fake.createHub();
  hub.configure(CREDENTIALS);
  await hub.refresh();
  return hub;
}
