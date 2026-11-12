// -----------------------------------------------------------------------------
// Device type: PUCK.
//
// The Flair puck is the room sensor (and the thermostat display Flair
// controls the vents with). Gladys gets its temperature and humidity.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { RESOURCES } from '../flair/client.js';
import { isInactive, nameOf, stateEntry } from './helpers.js';

export const PUCK_FEATURES = { TEMPERATURE: 'temperature', HUMIDITY: 'humidity' };

export const puck = {
  kind: 'puck',
  resource: RESOURCES.PUCKS,

  build(gladys, resource) {
    const ids = gladys.externalIds(this.kind, resource.id);
    return {
      name: nameOf(resource, 'Puck'),
      external_id: ids.device,
      features: [
        {
          name: 'Temperature',
          external_id: ids.feature(PUCK_FEATURES.TEMPERATURE),
          category: DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.CELSIUS,
          read_only: true,
          has_feedback: false,
          keep_history: true,
          min: -20,
          max: 60,
        },
        {
          name: 'Humidity',
          external_id: ids.feature(PUCK_FEATURES.HUMIDITY),
          category: DEVICE_FEATURE_CATEGORIES.HUMIDITY_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.PERCENT,
          read_only: true,
          has_feedback: false,
          keep_history: true,
          min: 0,
          max: 100,
        },
      ],
    };
  },

  states(gladys, resource) {
    const ids = gladys.externalIds(this.kind, resource.id);
    const { attributes = {} } = resource;
    return [
      ...stateEntry(ids.feature(PUCK_FEATURES.TEMPERATURE), attributes['current-temperature-c']),
      ...stateEntry(ids.feature(PUCK_FEATURES.HUMIDITY), attributes['current-humidity']),
    ];
  },

  // A puck is a sensor: nothing to control from Gladys.
  toAttributes() {
    return null;
  },

  isReachable(resource) {
    return !isInactive(resource);
  },
};
