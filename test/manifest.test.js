// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The store indexer validates the manifest, but nothing there knows which
// handlers the code registers — these tests keep both sides in sync.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTIONS } from '../src/capabilities/actions.js';
import { SCENE_ACTIONS } from '../src/capabilities/scenes.js';
import { SCENE_TRIGGER_KEYS } from '../src/capabilities/triggers.js';
import { WIDGETS } from '../src/capabilities/widget.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const allFields = [
  ...(manifest.config_schema ?? []),
  ...[
    ...(manifest.actions ?? []),
    ...(manifest.scene_triggers ?? []),
    ...(manifest.scene_actions ?? []),
  ].flatMap((item) => item.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

const keysOf = (list) => (list ?? []).map((entry) => entry.key);

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

function isAtLeast(version, required) {
  for (let i = 0; i < required.length; i += 1) {
    if (version[i] !== required[i]) {
      return version[i] > required[i];
    }
  }
  return true;
}

/** Every multi-language text of the manifest, with its path. */
function* texts(node, path = '') {
  if (Array.isArray(node)) {
    for (const [index, item] of node.entries()) {
      yield* texts(item, `${path}[${index}]`);
    }
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (['label', 'description', 'placeholder'].includes(key)) {
        yield [`${path}.${key}`, value];
      } else {
        yield* texts(value, `${path}.${key}`);
      }
    }
  }
}

test('every text of the manifest is written in English, French, German and Spanish', () => {
  for (const [path, value] of texts(manifest)) {
    assert.equal(typeof value, 'object', `${path} must be a multi-language object`);
    assert.deepEqual(Object.keys(value).sort(), [...LANGUAGES].sort(), `${path} languages`);
    for (const language of LANGUAGES) {
      assert.ok(value[language]?.trim(), `${path}.${language} is empty`);
    }
  }
});

test('Flair is a cloud service: the manifest declares the cloud transport only', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
});

test('every manifest action has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), Object.keys(ACTIONS).sort());
});

test('every scene_actions key has an onSceneAction handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_actions).sort(), Object.keys(SCENE_ACTIONS).sort());
});

test('every widget key has a content handler, and vice versa', () => {
  const declared = keysOf(manifest.widgets);
  assert.ok(declared.length >= 1 && declared.length <= 5, 'one to five widgets');
  assert.deepEqual(declared.sort(), Object.keys(WIDGETS).sort());
  for (const key of declared) {
    assert.equal(typeof WIDGETS[key].get, 'function');
  }
});

test('every scene trigger the code fires is declared, and vice versa', () => {
  // An undeclared key is a 404 on publishSceneEvent; a declared key nobody
  // fires is a dead card in the scene editor.
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), [...SCENE_TRIGGER_KEYS].sort());
});

test('the minimum Gladys version covers every field the manifest uses', () => {
  const version = minGladysVersion();
  // categories: 4.86; scene/widget capabilities: 5.1; keywords: 5.3.
  if (manifest.categories) {
    assert.ok(isAtLeast(version, [4, 86, 0]), 'categories need 4.86.0');
    assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
  }
  if (['scene_triggers', 'scene_actions', 'widgets'].some((field) => field in manifest)) {
    assert.ok(isAtLeast(version, [5, 1, 0]), 'scene and widget capabilities need 5.1.0');
  }
  if ('keywords' in manifest) {
    assert.ok(isAtLeast(version, [5, 3, 0]), 'keywords need 5.3.0');
  }
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  for (const field of manifest.config_schema) {
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, `DEFAULT_CONFIG.${field.key}`);
    }
  }
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    assert.ok(keysOf(manifest.config_schema).includes(key), `${key} is not in config_schema`);
  }
});

test('the client secret is a secret field', () => {
  const secret = manifest.config_schema.find((field) => field.key === 'client_secret');
  assert.equal(secret.type, 'secret');
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    assert.equal(section.placeholder, undefined);
    assert.ok(!(section.key in DEFAULT_CONFIG));
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//, 'section links must be https');
    }
  }
});

test('dynamic selects declare a source and no static options', () => {
  const dynamicSelects = allFields.filter((f) => f.source !== undefined);
  assert.ok(dynamicSelects.length > 0);
  for (const field of dynamicSelects) {
    assert.equal(field.source, 'devices');
    assert.equal(field.options, undefined, `field "${field.key}": source and options together`);
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  // The Release workflow writes all three: a mismatch means one was edited by hand.
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.docker_image, `ghcr.io/prohand/gladys-flair:${manifest.version}`);
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});
