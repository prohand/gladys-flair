// -----------------------------------------------------------------------------
// The refresh loop: read Flair, then tell Gladys what changed.
//
// Flair has no push channel, so the integration reads the account every
// `poll_frequency` seconds (2 minutes by default) with its own timer rather
// than Gladys' per-device poll: one refresh is four requests for the whole
// home, however many vents it has.
//
// After each refresh:
//   1. new or removed Flair devices -> the discovery list is published again;
//   2. the values that changed are published (publishChangedStates, with a
//      heartbeat so a steady temperature stays recently dated);
//   3. the transport badge of every device (cloud / unreachable);
//   4. the scene triggers found by comparing with the previous refresh;
//   5. the connection status of the Configuration screen, and the widget.
// -----------------------------------------------------------------------------

import { createLogger, DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { FlairAuthError } from './flair/client.js';
import { buildDiscoveredDevices, buildStates, buildTransportEntries } from './devices/index.js';
import { detectSceneEvents } from './capabilities/triggers.js';
import { refreshWidgets } from './capabilities/widget.js';
import { localize, pick } from './i18n.js';

const logger = createLogger({ name: 'sync' });

const STATE_HEARTBEAT_MS = 30 * 60 * 1000;

export const STATUS_MESSAGES = {
  missingCredentials: localize((l) =>
    pick(l, {
      en: 'Enter the Flair API client ID and client secret.',
      fr: "Saisissez l'identifiant client et le secret client de l'API Flair.",
      de: 'Gib die Client-ID und das Client-Secret der Flair-API ein.',
      es: 'Introduzca el ID de cliente y el secreto de cliente de la API de Flair.',
    }),
  ),
  authRefused: localize((l) =>
    pick(l, {
      en: 'Flair refused the API credentials: check the client ID and secret.',
      fr: "Flair a refusé les identifiants de l'API : vérifiez l'identifiant et le secret client.",
      de: 'Flair hat die API-Zugangsdaten abgelehnt: prüfe Client-ID und Client-Secret.',
      es: 'Flair rechazó las credenciales de la API: compruebe el ID y el secreto de cliente.',
    }),
  ),
  unreachable: localize((l) =>
    pick(l, {
      en: 'The Flair cloud does not answer, retrying at the next refresh.',
      fr: 'Le cloud Flair ne répond pas, nouvel essai au prochain rafraîchissement.',
      de: 'Die Flair-Cloud antwortet nicht, neuer Versuch bei der nächsten Aktualisierung.',
      es: 'La nube de Flair no responde, se reintentará en la próxima actualización.',
    }),
  ),
};

/** The device external ids of a discovery list, sorted, as one string. */
function deviceSetKey(devices) {
  return devices
    .map((device) => device.external_id)
    .sort()
    .join('\n');
}

/**
 * @param {{ gladys: import('@gladysassistant/integration-sdk').GladysIntegration,
 *   hub: import('./flair/hub.js').FlairHub, getConfig: () => object }} context
 */
export function createSync({ gladys, hub, getConfig }) {
  let running = null;
  let timer = null;
  let stopped = true;
  let publishedDevices = null;
  let lastStatusOk = null;

  async function setStatus(ok, message) {
    lastStatusOk = ok;
    await gladys.setConnectionStatus(ok, message).catch((err) => {
      logger.warn(`Could not report the connection status: ${err.message}`);
    });
  }

  async function runOnce({ publishDevices = false } = {}) {
    if (!hub.configured) {
      await setStatus(false, STATUS_MESSAGES.missingCredentials);
      refreshWidgets(gladys);
      return { ok: false, reason: 'missing-credentials' };
    }

    const previous = hub.lastRefreshAt ? hub.snapshot : null;
    try {
      await hub.refresh();
    } catch (err) {
      const auth = err instanceof FlairAuthError;
      logger.warn(`Flair refresh failed: ${err.message}`);
      await setStatus(false, auth ? STATUS_MESSAGES.authRefused : STATUS_MESSAGES.unreachable);
      const entries = buildTransportEntries(gladys, hub, { cloudReachable: false });
      if (entries.length > 0) {
        await gladys.publishTransports(entries).catch(() => {});
      }
      refreshWidgets(gladys);
      return { ok: false, reason: auth ? 'auth' : 'unreachable', error: err };
    }

    // 1. Devices: only when the list changed (or on demand).
    const devices = buildDiscoveredDevices(gladys, hub);
    const key = deviceSetKey(devices);
    if (publishDevices || key !== publishedDevices) {
      await gladys.publishDiscoveredDevices(devices);
      publishedDevices = key;
    }

    // 2. Values that changed.
    const states = buildStates(gladys, hub);
    if (states.length > 0) {
      await gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });
    }

    // 3. Transport badges.
    const transports = buildTransportEntries(gladys, hub, { cloudReachable: true });
    if (transports.length > 0) {
      await gladys.publishTransports(transports);
    }

    // 4. Scene triggers. A refused event must not stop the loop.
    for (const event of detectSceneEvents(gladys, previous, hub.snapshot)) {
      logger.info(`Scene event ${event.key} <- ${event.data.device}`);
      await gladys.publishSceneEvent(event.key, event.data).catch((err) => {
        logger.warn(`Scene event ${event.key} refused: ${err.message}`);
      });
    }

    // 5. Status and widget.
    if (lastStatusOk !== true) {
      await setStatus(true);
    }
    refreshWidgets(gladys);
    return {
      ok: true,
      counts: {
        structures: hub.snapshot.structures.length,
        rooms: hub.snapshot.rooms.length,
        vents: hub.snapshot.vents.length,
        pucks: hub.snapshot.pucks.length,
        offline: transports.filter((t) => t.transport === DEVICE_TRANSPORTS.UNREACHABLE).length,
      },
    };
  }

  /** One refresh at a time: a request made during a refresh joins it. */
  function run(options) {
    if (!running) {
      running = runOnce(options).finally(() => {
        running = null;
      });
    }
    return running;
  }

  function schedule() {
    clearTimeout(timer);
    if (stopped) {
      return;
    }
    timer = setTimeout(async () => {
      try {
        await run();
      } catch (err) {
        logger.error('Flair refresh loop failed', err);
      }
      schedule();
    }, getConfig().poll_frequency * 1000);
  }

  return {
    run,
    /** Refresh now, then every `poll_frequency` seconds. */
    async start(options) {
      stopped = false;
      try {
        return await run(options);
      } finally {
        schedule();
      }
    },
    /** Apply a new poll_frequency without waiting for the current timer. */
    reschedule: schedule,
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
    /** Forget what was published: the next run publishes everything again. */
    reset() {
      publishedDevices = null;
      lastStatusOk = null;
    },
  };
}
