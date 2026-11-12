// -----------------------------------------------------------------------------
// The last known picture of the Flair account, and the only way to change it.
//
// One refresh reads the four collections (structures, rooms, vents, pucks) in
// parallel: four requests whatever the number of vents, which keeps a large
// home far from the Flair rate limit. Devices, states, the widget and the
// scene triggers are all computed from this snapshot.
//
// An order (vent position, room set point, home/away...) is sent to Flair,
// then merged into the snapshot at once: Gladys shows the new value without
// waiting for the next refresh, and the next refresh does not read the change
// as an event coming from elsewhere.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { FlairClient, RESOURCES } from './client.js';

const logger = createLogger({ name: 'flair-hub' });

/** The id of a JSON:API to-one relationship, or null. */
export function relationId(resource, name) {
  return resource?.relationships?.[name]?.data?.id ?? null;
}

export function emptySnapshot() {
  return { structures: [], rooms: [], vents: [], pucks: [] };
}

export class FlairHub {
  /**
   * @param {{ createClient?: (credentials: { clientId: string, clientSecret: string }) => FlairClient }} [options]
   */
  constructor({ createClient = (credentials) => new FlairClient(credentials) } = {}) {
    this.createClient = createClient;
    this.client = null;
    this.credentialsKey = null;
    this.snapshot = emptySnapshot();
    this.lastRefreshAt = null;
    this.lastError = null;
  }

  /** Follow the configuration: new credentials, new client, empty picture. */
  configure(config) {
    const key = `${config.client_id}\u0000${config.client_secret}`;
    if (key === this.credentialsKey) {
      return;
    }
    this.credentialsKey = key;
    this.client = hasCredentials(config)
      ? this.createClient({ clientId: config.client_id, clientSecret: config.client_secret })
      : null;
    this.snapshot = emptySnapshot();
    this.lastRefreshAt = null;
    this.lastError = null;
  }

  get configured() {
    return this.client !== null;
  }

  /** Read the whole account again. Rejects (and keeps the old picture) on failure. */
  async refresh() {
    if (!this.client) {
      throw new Error('Flair API credentials are missing');
    }
    try {
      const [structures, rooms, vents, pucks] = await Promise.all([
        this.client.list(RESOURCES.STRUCTURES),
        this.client.list(RESOURCES.ROOMS),
        this.client.list(RESOURCES.VENTS),
        this.client.list(RESOURCES.PUCKS),
      ]);
      this.snapshot = {
        // A structure still being set up in the Flair app has nothing usable.
        structures: structures.filter((s) => s.attributes?.['setup-complete'] !== false),
        rooms,
        vents,
        pucks,
      };
      this.lastRefreshAt = new Date();
      this.lastError = null;
      logger.debug(
        `Flair refreshed: ${structures.length} structure(s), ${rooms.length} room(s), ` +
          `${vents.length} vent(s), ${pucks.length} puck(s)`,
      );
      return this.snapshot;
    } catch (err) {
      this.lastError = err;
      throw err;
    }
  }

  /** One resource of the snapshot, e.g. `get('vents', '42')`. */
  get(type, id) {
    return this.snapshot[type]?.find((resource) => resource.id === String(id)) ?? null;
  }

  /** The structure a room, vent or puck belongs to. */
  structureOf(type, resource) {
    if (type === RESOURCES.STRUCTURES) {
      return resource;
    }
    const room =
      type === RESOURCES.ROOMS ? resource : this.get('rooms', relationId(resource, 'room'));
    const structureId = relationId(room, 'structure') ?? relationId(resource, 'structure');
    return (
      this.get('structures', structureId) ??
      (this.snapshot.structures.length === 1 ? this.snapshot.structures[0] : null)
    );
  }

  /** The room a vent or puck is placed in. */
  roomOf(resource) {
    return this.get('rooms', relationId(resource, 'room'));
  }

  /** Send a change to Flair, then reflect it in the snapshot. */
  async update(type, id, attributes) {
    if (!this.client) {
      throw new Error('Flair API credentials are missing');
    }
    const updated = await this.client.update(type, id, attributes);
    const resource = this.get(type, id);
    if (resource) {
      resource.attributes = {
        ...resource.attributes,
        ...attributes,
        ...(updated?.attributes ?? {}),
      };
    }
    return resource;
  }
}

export function hasCredentials(config) {
  return Boolean(config.client_id && config.client_secret);
}
