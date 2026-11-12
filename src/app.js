// -----------------------------------------------------------------------------
// SDK wiring: every Gladys handler, registered before connect().
//
// Kept out of index.js so the tests drive the whole integration through the
// fake Gladys of the SDK (`createFakeGladys`) with a fake Flair API.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { FlairHub } from './flair/hub.js';
import { applyCommand } from './devices/index.js';
import { createSync, STATUS_MESSAGES } from './sync.js';
import { ACTIONS } from './capabilities/actions.js';
import { SCENE_ACTIONS } from './capabilities/scenes.js';
import { WIDGETS } from './capabilities/widget.js';
import { localize, pick } from './i18n.js';

const logger = createLogger({ name: 'app' });

/**
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {{ hub?: FlairHub }} [options]
 * @returns {{ hub: FlairHub, sync: ReturnType<typeof createSync>, getConfig: () => object }}
 */
export function registerHandlers(gladys, { hub = new FlairHub() } = {}) {
  let config = normalizeConfig();
  const getConfig = () => config;
  const sync = createSync({ gladys, hub, getConfig });

  function applyConfig(raw) {
    config = normalizeConfig(raw);
    hub.configure(config);
  }

  // --- Discovery: refresh, then publish every Flair device -----------------
  gladys.onScanRequest(async () => {
    logger.info('onScanRequest -> refreshing Flair');
    await sync.run({ publishDevices: true });
  });

  // --- Commands: vent position, set point, home/away... --------------------
  gladys.onSetValue(async (device, feature, value) => {
    logger.info(`onSetValue <- ${feature.external_id} = ${value}`);
    await applyCommand(gladys, hub, {
      deviceExternalId: device.external_id,
      featureExternalId: feature.external_id,
      value,
    });
  });

  // --- Configuration screen buttons ----------------------------------------
  for (const [key, handler] of Object.entries(ACTIONS)) {
    gladys.onAction(key, (fields) => handler(gladys, { fields, hub, sync, config }));
  }

  // --- Scene actions (Gladys 5.1+) ------------------------------------------
  for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
    gladys.onSceneAction(key, (fields) => handler(gladys, { fields, hub, config }));
  }

  // --- Dashboard widget (Gladys 5.1+) ---------------------------------------
  for (const [key, widget] of Object.entries(WIDGETS)) {
    gladys.onWidgetGet(key, (request) => widget.get(gladys, { ...request, hub, config }));
    gladys.onWidgetAction(key, (actionKey, params, { settings }) =>
      widget.action(gladys, { actionKey, params, settings, hub, sync, config }),
    );
  }

  // --- Configuration updated: new credentials or a new refresh interval -----
  gladys.onConfigUpdated(async (raw) => {
    logger.info('onConfigUpdated -> new configuration received');
    applyConfig(raw);
    sync.reset();
    await sync.start({ publishDevices: true });
  });

  // --- Connection lifecycle -------------------------------------------------
  gladys.on('connected', async () => {
    try {
      applyConfig(await gladys.getConfig());
      sync.reset();
      await sync.start({ publishDevices: true });
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
      await gladys
        .setConnectionStatus(
          false,
          localize((l) =>
            pick(l, {
              en: 'Initialization failed, check the integration logs.',
              fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
              de: 'Initialisierung fehlgeschlagen, prüfe die Logs der Integration.',
              es: 'La inicialización falló, revise los registros de la integración.',
            }),
          ),
        )
        .catch(() => {});
    }
  });

  gladys.on('disconnected', () => {
    sync.stop();
  });

  return { hub, sync, getConfig };
}

export { STATUS_MESSAGES };
