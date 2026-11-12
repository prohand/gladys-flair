// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults and
// normalizes what Gladys sends, so the rest of the code never deals with
// `undefined` or with numbers typed as strings.
// -----------------------------------------------------------------------------

// The fastest refresh the integration allows: the Flair cloud is shared by
// every user, and a vent does not move faster than this anyway.
export const MIN_POLL_FREQUENCY = 60;
export const MAX_POLL_FREQUENCY = 3600;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  client_id: '',
  client_secret: '',
  // Seconds between two reads of the Flair account.
  poll_frequency: 120,
};

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const pollFrequency = Number(raw.poll_frequency ?? DEFAULT_CONFIG.poll_frequency);
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    client_id: String(raw.client_id ?? '').trim(),
    client_secret: String(raw.client_secret ?? '').trim(),
    poll_frequency: Number.isFinite(pollFrequency)
      ? Math.min(MAX_POLL_FREQUENCY, Math.max(MIN_POLL_FREQUENCY, pollFrequency))
      : DEFAULT_CONFIG.poll_frequency,
  };
}
