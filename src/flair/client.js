// -----------------------------------------------------------------------------
// Flair cloud API client (https://api.flair.co).
//
// Flair exposes a JSON:API over HTTPS, reached with OAuth 2.0 "client
// credentials": the user asks Flair support for a client_id / client_secret
// pair, the integration trades it for a bearer token at /oauth2/token and
// renews it before it expires. There is no local API: every read and every
// order goes through the Flair cloud.
//
// Only the resources this integration uses are read: structures (homes),
// rooms, vents and pucks. Each comes back as JSON:API resources
// `{ id, type, attributes, relationships }`, kept as is: the rest of the code
// reads the `attributes` with Flair's own names (`percent-open`,
// `set-point-c`...).
//
// Never log the client secret nor the token.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'flair-api' });

export const FLAIR_BASE_URL = 'https://api.flair.co';

// What the integration reads and changes, nothing more. Rooms are reached
// through the structure scopes.
export const FLAIR_SCOPES = [
  'structures.view',
  'structures.edit',
  'vents.view',
  'vents.edit',
  'pucks.view',
  'pucks.edit',
];

// The resource collections read at every refresh, by JSON:API type.
export const RESOURCES = {
  STRUCTURES: 'structures',
  ROOMS: 'rooms',
  VENTS: 'vents',
  PUCKS: 'pucks',
};

const REQUEST_TIMEOUT_MS = 20_000;
// Renew the token a little before Flair says it expires: a request sent with a
// token that dies on the way is refused.
const TOKEN_MARGIN_MS = 5 * 60 * 1000;
// A safety net against a `links.next` that loops.
const MAX_PAGES = 20;

/** The credentials were refused: retrying the same ones will not help. */
export class FlairAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FlairAuthError';
  }
}

/** Any other failure of the Flair API (network, 5xx, rate limit...). */
export class FlairApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'FlairApiError';
    this.status = status;
  }
}

export class FlairClient {
  /**
   * @param {{ clientId: string, clientSecret: string, fetch?: typeof fetch,
   *   baseUrl?: string, now?: () => number }} options
   */
  constructor({ clientId, clientSecret, fetch = globalThis.fetch, baseUrl, now = Date.now }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.fetch = fetch;
    this.baseUrl = baseUrl ?? FLAIR_BASE_URL;
    this.now = now;
    this.token = null;
    this.tokenExpiresAt = 0;
    this.pendingToken = null;
  }

  /**
   * A valid bearer token, fetched again only when needed. A refresh reads
   * four collections in parallel: they share ONE token request, a second
   * request would make Flair revoke the first token.
   */
  async getToken() {
    if (this.token && this.now() < this.tokenExpiresAt - TOKEN_MARGIN_MS) {
      return this.token;
    }
    if (!this.pendingToken) {
      this.pendingToken = this.requestToken().finally(() => {
        this.pendingToken = null;
      });
    }
    return this.pendingToken;
  }

  async requestToken() {
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: FLAIR_SCOPES.join(' '),
      grant_type: 'client_credentials',
    });
    const response = await this.send(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
    });
    const payload = await readJson(response);
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      throw new FlairAuthError(
        `Flair refused the API credentials (${payload?.error ?? response.status})`,
      );
    }
    if (!response.ok || !payload?.access_token) {
      throw new FlairApiError(
        `Flair token request failed (HTTP ${response.status})`,
        response.status,
      );
    }
    this.token = payload.access_token;
    const lifetimeSeconds = Number(payload.expires_in) || 3600;
    this.tokenExpiresAt = this.now() + lifetimeSeconds * 1000;
    logger.debug(`Flair token obtained, valid ${lifetimeSeconds} s`);
    return this.token;
  }

  /**
   * Forget a token Flair refused, so the next request asks for a new one.
   * Only that token: parallel requests refused together must not throw away
   * the fresh token the first of them already obtained.
   */
  resetToken(refused = this.token) {
    if (this.token === refused) {
      this.token = null;
      this.tokenExpiresAt = 0;
    }
  }

  /**
   * Every resource of a collection (all pages), e.g. `list('vents')`.
   * @returns {Promise<Array<{ id: string, type: string, attributes: object, relationships: object }>>}
   */
  async list(type) {
    const resources = [];
    let path = `/api/${type}`;
    for (let page = 0; path && page < MAX_PAGES; page += 1) {
      const payload = await this.request('GET', path);
      resources.push(...(Array.isArray(payload?.data) ? payload.data : []));
      path = payload?.links?.next ?? null;
    }
    return resources;
  }

  /**
   * Change attributes of one resource, e.g.
   * `update('vents', '123', { 'percent-open': 50 })`.
   * Resolves with the updated resource when Flair returns it.
   */
  async update(type, id, attributes) {
    const payload = await this.request('PATCH', `/api/${type}/${encodeURIComponent(id)}`, {
      data: { type, attributes, relationships: {} },
    });
    return payload?.data ?? null;
  }

  /** One authenticated JSON request. A 401 renews the token once. */
  async request(method, path, body, { retried = false } = {}) {
    const token = await this.getToken();
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const response = await this.send(url, {
      method,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401 && !retried) {
      // Revoked or expired early: one fresh token, then give up.
      this.resetToken(token);
      return this.request(method, path, body, { retried: true });
    }
    if (response.status === 401 || response.status === 403) {
      throw new FlairAuthError(`Flair refused the request ${method} ${path} (${response.status})`);
    }
    if (response.status === 204) {
      return null;
    }
    const payload = await readJson(response);
    if (!response.ok) {
      const detail = payload?.errors?.[0]?.detail ?? payload?.errors?.[0]?.title ?? '';
      throw new FlairApiError(
        `Flair API ${method} ${path} failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`,
        response.status,
      );
    }
    return payload;
  }

  async send(url, init) {
    try {
      return await this.fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (err) {
      throw new FlairApiError(`Flair API unreachable: ${err.message}`);
    }
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
