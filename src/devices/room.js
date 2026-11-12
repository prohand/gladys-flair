// -----------------------------------------------------------------------------
// Device type: ROOM.
//
// A Flair room gathers the vents and the puck of one room. Gladys gets its
// set point as a thermostat (Flair opens and closes the vents to reach it in
// Auto mode), the temperature and humidity measured by its puck, and its
// "Active" switch (an inactive room is left aside by Flair: vents closed).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';
import { RESOURCES } from '../flair/client.js';
import { isOn, nameOf, numberOrNull, stateEntry } from './helpers.js';

export const ROOM_FEATURES = {
  SET_POINT: 'set-point',
  TEMPERATURE: 'temperature',
  HUMIDITY: 'humidity',
  ACTIVE: 'active',
};

// The range Gladys offers on the set point slider. Flair itself accepts a
// slightly wider one; these bounds cover any comfortable room.
export const SET_POINT_MIN = 10;
export const SET_POINT_MAX = 32;

export const room = {
  kind: 'room',
  resource: RESOURCES.ROOMS,

  build(gladys, resource) {
    const ids = gladys.externalIds(this.kind, resource.id);
    return {
      name: nameOf(resource, 'Room'),
      external_id: ids.device,
      features: [
        {
          name: 'Set point',
          external_id: ids.feature(ROOM_FEATURES.SET_POINT),
          category: DEVICE_FEATURE_CATEGORIES.THERMOSTAT,
          type: DEVICE_FEATURE_TYPES.THERMOSTAT.TARGET_TEMPERATURE,
          unit: DEVICE_FEATURE_UNITS.CELSIUS,
          read_only: false,
          has_feedback: true,
          keep_history: true,
          min: SET_POINT_MIN,
          max: SET_POINT_MAX,
        },
        {
          name: 'Temperature',
          external_id: ids.feature(ROOM_FEATURES.TEMPERATURE),
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
          external_id: ids.feature(ROOM_FEATURES.HUMIDITY),
          category: DEVICE_FEATURE_CATEGORIES.HUMIDITY_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.PERCENT,
          read_only: true,
          has_feedback: false,
          keep_history: true,
          min: 0,
          max: 100,
        },
        {
          name: 'Active',
          external_id: ids.feature(ROOM_FEATURES.ACTIVE),
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
    return [
      ...stateEntry(ids.feature(ROOM_FEATURES.SET_POINT), attributes['set-point-c']),
      ...stateEntry(ids.feature(ROOM_FEATURES.TEMPERATURE), attributes['current-temperature-c']),
      ...stateEntry(ids.feature(ROOM_FEATURES.HUMIDITY), attributes['current-humidity']),
      ...(typeof attributes.active === 'boolean'
        ? [
            {
              device_feature_external_id: ids.feature(ROOM_FEATURES.ACTIVE),
              state: attributes.active ? 1 : 0,
            },
          ]
        : []),
    ];
  },

  toAttributes(featureKey, value) {
    if (featureKey === ROOM_FEATURES.SET_POINT) {
      return { 'set-point-c': clampSetPoint(value) };
    }
    if (featureKey === ROOM_FEATURES.ACTIVE) {
      return { active: isOn(value) };
    }
    return null;
  },

  isReachable() {
    return true;
  },
};

/** A set point Flair accepts, rounded to the half degree. */
export function clampSetPoint(value) {
  const number = numberOrNull(value);
  if (number === null) {
    throw new Error(`Invalid set point: ${value}`);
  }
  const clamped = Math.min(SET_POINT_MAX, Math.max(SET_POINT_MIN, number));
  return Math.round(clamped * 2) / 2;
}
