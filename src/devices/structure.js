// -----------------------------------------------------------------------------
// Device type: STRUCTURE (a Flair home).
//
// Two switches:
//   - "Home": on = Home, off = Away. Flair lowers the comfort targets of every
//     room while the home is away;
//   - "Auto mode": on = Flair drives the vents itself from the room set
//     points, off = "Manual" mode, the vents stay where they are put.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { RESOURCES } from '../flair/client.js';
import { isOn, nameOf } from './helpers.js';

export const STRUCTURE_FEATURES = { HOME: 'home', AUTO_MODE: 'auto-mode' };

export const FLAIR_MODES = { AUTO: 'auto', MANUAL: 'manual' };

export const structure = {
  kind: 'structure',
  resource: RESOURCES.STRUCTURES,

  build(gladys, resource) {
    const ids = gladys.externalIds(this.kind, resource.id);
    return {
      name: `Flair ${nameOf(resource, 'home')}`,
      external_id: ids.device,
      features: [
        {
          name: 'Home (off = Away)',
          external_id: ids.feature(STRUCTURE_FEATURES.HOME),
          category: DEVICE_FEATURE_CATEGORIES.SWITCH,
          type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
          read_only: false,
          has_feedback: true,
          keep_history: true,
          min: 0,
          max: 1,
        },
        {
          name: 'Auto mode (off = Manual)',
          external_id: ids.feature(STRUCTURE_FEATURES.AUTO_MODE),
          category: DEVICE_FEATURE_CATEGORIES.SWITCH,
          type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
          read_only: false,
          has_feedback: true,
          keep_history: true,
          min: 0,
          max: 1,
        },
      ],
    };
  },

  states(gladys, resource) {
    const ids = gladys.externalIds(this.kind, resource.id);
    const { attributes = {} } = resource;
    const states = [];
    if (typeof attributes.home === 'boolean') {
      states.push({
        device_feature_external_id: ids.feature(STRUCTURE_FEATURES.HOME),
        state: attributes.home ? 1 : 0,
      });
    }
    if (attributes.mode === FLAIR_MODES.AUTO || attributes.mode === FLAIR_MODES.MANUAL) {
      states.push({
        device_feature_external_id: ids.feature(STRUCTURE_FEATURES.AUTO_MODE),
        state: attributes.mode === FLAIR_MODES.AUTO ? 1 : 0,
      });
    }
    return states;
  },

  /** The Flair attributes a Gladys command on a feature turns into. */
  toAttributes(featureKey, value) {
    if (featureKey === STRUCTURE_FEATURES.HOME) {
      return { home: isOn(value) };
    }
    if (featureKey === STRUCTURE_FEATURES.AUTO_MODE) {
      return { mode: isOn(value) ? FLAIR_MODES.AUTO : FLAIR_MODES.MANUAL };
    }
    return null;
  },

  // A home has no radio of its own: it is reachable whenever the cloud is.
  isReachable() {
    return true;
  },
};
