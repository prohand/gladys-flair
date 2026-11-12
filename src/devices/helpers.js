// -----------------------------------------------------------------------------
// Small helpers shared by the device blueprints.
// -----------------------------------------------------------------------------

/** A finite number, or null for a reading Flair does not have (no puck...). */
export function numberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** One state entry, or nothing when the value is unknown. */
export function stateEntry(featureExternalId, value) {
  const state = numberOrNull(value);
  return state === null ? [] : [{ device_feature_external_id: featureExternalId, state }];
}

/** The display name of a Flair resource, with a fallback built from its id. */
export function nameOf(resource, fallback) {
  const name = resource?.attributes?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : `${fallback} ${resource.id}`;
}

/** Gladys sends 0/1 for a binary feature; be tolerant of booleans and strings. */
export function isOn(value) {
  return value === 1 || value === true || value === '1';
}

/** A device is unreachable when Flair flags it inactive (battery, radio...). */
export function isInactive(resource) {
  return resource?.attributes?.inactive === true;
}
