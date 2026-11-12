// -----------------------------------------------------------------------------
// Device type: SMART VENT.
//
// A Flair vent is a motorized register: Gladys gets it as a shutter, with a
// position (0 % closed, 100 % open) and the open / close buttons.
//
// In Auto mode Flair moves the vents itself to reach the room set points: a
// position set by hand holds until Flair's next decision. That is expected,
// and logged; the Manual mode (the "Auto mode" switch of the home) keeps the
// position.
// -----------------------------------------------------------------------------

import {
  createLogger,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { RESOURCES } from '../flair/client.js';
import { isInactive, nameOf, numberOrNull, stateEntry } from './helpers.js';

const logger = createLogger({ name: 'vent' });

export const VENT_FEATURES = { STATE: 'state', POSITION: 'position' };

// The values of a Gladys shutter `state` feature.
export const SHUTTER_STATE = { OPEN: 1, STOP: 0, CLOSE: -1 };

export const vent = {
  kind: 'vent',
  resource: RESOURCES.VENTS,

  build(gladys, resource) {
    const ids = gladys.externalIds(this.kind, resource.id);
    return {
      name: nameOf(resource, 'Vent'),
      external_id: ids.device,
      features: [
        {
          name: 'Open / close',
          external_id: ids.feature(VENT_FEATURES.STATE),
          category: DEVICE_FEATURE_CATEGORIES.SHUTTER,
          type: DEVICE_FEATURE_TYPES.SHUTTER.STATE,
          read_only: false,
          has_feedback: true,
          keep_history: false,
          min: -1,
          max: 1,
        },
        {
          name: 'Opening',
          external_id: ids.feature(VENT_FEATURES.POSITION),
          category: DEVICE_FEATURE_CATEGORIES.SHUTTER,
          type: DEVICE_FEATURE_TYPES.SHUTTER.POSITION,
          unit: DEVICE_FEATURE_UNITS.PERCENT,
          read_only: false,
          has_feedback: true,
          keep_history: true,
          min: 0,
          max: 100,
        },
      ],
    };
  },

  states(gladys, resource) {
    const ids = gladys.externalIds(this.kind, resource.id);
    const position = numberOrNull(resource.attributes?.['percent-open']);
    if (position === null) {
      return [];
    }
    return [
      ...stateEntry(ids.feature(VENT_FEATURES.POSITION), position),
      {
        device_feature_external_id: ids.feature(VENT_FEATURES.STATE),
        state: position > 0 ? SHUTTER_STATE.OPEN : SHUTTER_STATE.CLOSE,
      },
    ];
  },

  toAttributes(featureKey, value) {
    if (featureKey === VENT_FEATURES.POSITION) {
      return { 'percent-open': clampPosition(value) };
    }
    if (featureKey === VENT_FEATURES.STATE) {
      const state = Number(value);
      if (state === SHUTTER_STATE.OPEN) {
        return { 'percent-open': 100 };
      }
      if (state === SHUTTER_STATE.CLOSE) {
        return { 'percent-open': 0 };
      }
      // STOP: a vent moves in a second, there is nothing to stop.
      return {};
    }
    return null;
  },

  /** Say why a position set by hand may not last. */
  warnIfAutoMode(resource, structureResource) {
    if (structureResource?.attributes?.mode === 'auto') {
      logger.info(
        `Vent ${nameOf(resource, 'Vent')} moved while the home is in Auto mode: ` +
          'Flair may move it again at its next decision.',
      );
    }
  },

  isReachable(resource) {
    return !isInactive(resource);
  },
};

/** A position Flair accepts: an integer between 0 and 100. */
export function clampPosition(value) {
  const number = numberOrNull(value);
  if (number === null) {
    throw new Error(`Invalid vent position: ${value}`);
  }
  return Math.round(Math.min(100, Math.max(0, number)));
}
