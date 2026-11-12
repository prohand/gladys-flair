// -----------------------------------------------------------------------------
// Device registry.
//
// One Gladys device per Flair resource: each home (structure), room, vent and
// puck of the account. Every blueprint exposes the same shape:
//   - kind                         : external id namespace, never renamed
//   - resource                     : the Flair collection it comes from
//   - build(gladys, resource)      : the discovery payload
//   - states(gladys, resource)     : the current values, as publishStates entries
//   - toAttributes(featureKey, v)  : the Flair change a Gladys command means
//                                    (null: the feature is not controllable)
//   - isReachable(resource)        : false when Flair flags the device inactive
//
// External ids are `ext:<selector>:<kind>:<flair id>`: the Flair id never
// changes, renaming a vent in the Flair app keeps its history in Gladys.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { structure } from './structure.js';
import { room } from './room.js';
import { vent } from './vent.js';
import { puck } from './puck.js';

export const DEVICE_BLUEPRINTS = [structure, room, vent, puck];

/** Every `{ blueprint, resource }` pair of the current snapshot. */
export function deviceEntries(hub) {
  return DEVICE_BLUEPRINTS.flatMap((blueprint) =>
    (hub.snapshot[blueprint.resource] ?? []).map((resource) => ({ blueprint, resource })),
  );
}

/** The discovery payload: one device per Flair resource. */
export function buildDiscoveredDevices(gladys, hub) {
  return deviceEntries(hub).map(({ blueprint, resource }) => blueprint.build(gladys, resource));
}

/** The current values of every device, as publishStates entries. */
export function buildStates(gladys, hub) {
  return deviceEntries(hub).flatMap(({ blueprint, resource }) =>
    blueprint.states(gladys, resource),
  );
}

/**
 * The transport badge of every device. Flair is cloud only: `cloud` while the
 * API answers and the device reports, `unreachable` otherwise.
 */
export function buildTransportEntries(gladys, hub, { cloudReachable }) {
  return deviceEntries(hub).map(({ blueprint, resource }) => ({
    external_id: gladys.externalIds(blueprint.kind, resource.id).device,
    transport:
      cloudReachable && blueprint.isReachable(resource)
        ? DEVICE_TRANSPORTS.CLOUD
        : DEVICE_TRANSPORTS.UNREACHABLE,
  }));
}

/** The blueprint and Flair resource behind a device external id, or null. */
export function resolveDevice(gladys, hub, externalId) {
  for (const blueprint of DEVICE_BLUEPRINTS) {
    const prefix = gladys.externalIds(blueprint.kind, '').device;
    if (typeof externalId === 'string' && externalId.startsWith(prefix)) {
      const resource = hub.get(blueprint.resource, externalId.slice(prefix.length));
      return resource ? { blueprint, resource } : null;
    }
  }
  return null;
}

/**
 * Run a Gladys command on a feature, then publish the confirmed values.
 * Throws when the feature is not controllable or Flair refuses: the SDK then
 * acks the command as failed and Gladys shows it.
 */
export async function applyCommand(gladys, hub, { deviceExternalId, featureExternalId, value }) {
  const found = resolveDevice(gladys, hub, deviceExternalId);
  if (!found) {
    throw new Error(`Unknown Flair device ${deviceExternalId}`);
  }
  const { blueprint, resource } = found;
  const featureKey = featureExternalId.slice(deviceExternalId.length + 1);
  const attributes = blueprint.toAttributes(featureKey, value);
  if (attributes === null) {
    throw new Error(`The feature ${featureKey} of a Flair ${blueprint.kind} is read-only`);
  }
  if (Object.keys(attributes).length > 0) {
    await hub.update(blueprint.resource, resource.id, attributes);
    blueprint.warnIfAutoMode?.(resource, hub.structureOf(blueprint.resource, resource));
  }
  await gladys.publishStates(blueprint.states(gladys, resource));
  return resource;
}
