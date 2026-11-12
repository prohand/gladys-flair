// -----------------------------------------------------------------------------
// Scene actions (Gladys 5.1+, manifest `scene_actions`).
//
// Each handler receives the RESOLVED fields (a `"source": "devices"` field is
// the chosen device external_id) and resolves the declared outputs, readable
// by the next actions of the scene. Throwing fails this action only: the scene
// logs it and goes on. Choosing a device of the wrong kind (a puck for "set a
// vent position") is such a failure, with a message that says so.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { applyCommand, resolveDevice } from '../devices/index.js';
import { STRUCTURE_FEATURES } from '../devices/structure.js';
import { ROOM_FEATURES, clampSetPoint } from '../devices/room.js';
import { VENT_FEATURES, clampPosition } from '../devices/vent.js';
import { HOME_AWAY } from './triggers.js';

const logger = createLogger({ name: 'scenes' });

/** The device of the expected kind behind a field, or a clear error. */
function deviceOfKind(gladys, hub, externalId, kind) {
  const found = resolveDevice(gladys, hub, externalId);
  if (!found || found.blueprint.kind !== kind) {
    throw new Error(`The chosen device is not a Flair ${kind}: ${externalId ?? 'none'}`);
  }
  return found;
}

async function command(gladys, hub, kind, externalId, featureKey, value) {
  const { resource } = deviceOfKind(gladys, hub, externalId, kind);
  await applyCommand(gladys, hub, {
    deviceExternalId: externalId,
    featureExternalId: gladys.externalIds(kind, resource.id).feature(featureKey),
    value,
  });
  return resource;
}

export const SCENE_ACTIONS = {
  async set_vent_position(gladys, { fields, hub }) {
    const position = clampPosition(fields.position);
    logger.info(`Scene action set_vent_position <- ${fields.device} = ${position} %`);
    const resource = await command(
      gladys,
      hub,
      'vent',
      fields.device,
      VENT_FEATURES.POSITION,
      position,
    );
    const home = hub.structureOf('vents', resource);
    return {
      position: resource.attributes['percent-open'],
      // In Auto mode Flair may move the vent again: let the scene know.
      auto_mode: home?.attributes?.mode === 'auto',
    };
  },

  async set_room_set_point(gladys, { fields, hub }) {
    const setPoint = clampSetPoint(fields.temperature);
    logger.info(`Scene action set_room_set_point <- ${fields.device} = ${setPoint} °C`);
    const resource = await command(
      gladys,
      hub,
      'room',
      fields.device,
      ROOM_FEATURES.SET_POINT,
      setPoint,
    );
    return { set_point: resource.attributes['set-point-c'] };
  },

  async set_home_away(gladys, { fields, hub }) {
    const home = fields.mode !== HOME_AWAY.AWAY;
    logger.info(`Scene action set_home_away <- ${fields.device} = ${fields.mode}`);
    const resource = await command(
      gladys,
      hub,
      'structure',
      fields.device,
      STRUCTURE_FEATURES.HOME,
      home ? 1 : 0,
    );
    return { home: resource.attributes.home === true };
  },

  async set_auto_mode(gladys, { fields, hub }) {
    const auto = fields.enabled === true || fields.enabled === 'true';
    logger.info(`Scene action set_auto_mode <- ${fields.device} = ${auto}`);
    const resource = await command(
      gladys,
      hub,
      'structure',
      fields.device,
      STRUCTURE_FEATURES.AUTO_MODE,
      auto ? 1 : 0,
    );
    return { auto_mode: resource.attributes.mode === 'auto' };
  },
};
