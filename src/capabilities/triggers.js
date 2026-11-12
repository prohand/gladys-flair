// -----------------------------------------------------------------------------
// Scene triggers (Gladys 5.1+, manifest `scene_triggers`).
//
// Flair pushes nothing: the triggers are found by comparing two refreshes.
// The first refresh after a start only sets the reference, so a restart never
// replays "the home went away" for a home that left hours ago.
//
// A change Gladys asked for is merged into the snapshot at once (see
// FlairHub.update): the next refresh sees no difference and fires nothing, so
// a scene that sets the home away is never re-triggered by its own action.
// -----------------------------------------------------------------------------

import { DEVICE_BLUEPRINTS } from '../devices/index.js';
import { isInactive, nameOf } from '../devices/helpers.js';
import { structure } from '../devices/structure.js';

export const TRIGGERS = {
  HOME_AWAY_CHANGED: 'home_away_changed',
  CONNECTIVITY_CHANGED: 'device_connectivity_changed',
};

export const HOME_AWAY = { HOME: 'home', AWAY: 'away' };
export const CONNECTIVITY = { ONLINE: 'online', OFFLINE: 'offline' };

// The devices that report their own connectivity (structures and rooms are
// cloud-side objects, always "there").
const RADIO_BLUEPRINTS = DEVICE_BLUEPRINTS.filter((bp) => bp.kind === 'vent' || bp.kind === 'puck');

/** Every trigger key the integration fires (see test/manifest.test.js). */
export const SCENE_TRIGGER_KEYS = Object.values(TRIGGERS);

/**
 * The scene events between two snapshots, as `{ key, data }`.
 * `data` only carries keys the manifest declares (fields + variables).
 */
export function detectSceneEvents(gladys, previous, next) {
  if (!previous) {
    return [];
  }
  const events = [];

  for (const current of next.structures) {
    const before = previous.structures.find((s) => s.id === current.id);
    const was = before?.attributes?.home;
    const now = current.attributes?.home;
    if (typeof was === 'boolean' && typeof now === 'boolean' && was !== now) {
      events.push({
        key: TRIGGERS.HOME_AWAY_CHANGED,
        data: {
          device: gladys.externalIds(structure.kind, current.id).device,
          mode: now ? HOME_AWAY.HOME : HOME_AWAY.AWAY,
          home_name: nameOf(current, 'Home'),
        },
      });
    }
  }

  for (const blueprint of RADIO_BLUEPRINTS) {
    for (const current of next[blueprint.resource]) {
      const before = previous[blueprint.resource].find((r) => r.id === current.id);
      if (!before || isInactive(before) === isInactive(current)) {
        continue;
      }
      events.push({
        key: TRIGGERS.CONNECTIVITY_CHANGED,
        data: {
          device: gladys.externalIds(blueprint.kind, current.id).device,
          status: isInactive(current) ? CONNECTIVITY.OFFLINE : CONNECTIVITY.ONLINE,
          device_name: nameOf(current, blueprint.kind),
        },
      });
    }
  }

  return events;
}
