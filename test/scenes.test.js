import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { SCENE_ACTIONS } from '../src/capabilities/scenes.js';
import { TRIGGERS, detectSceneEvents } from '../src/capabilities/triggers.js';
import { CREDENTIALS, createFakeFlair, refreshedHub } from './helpers/fakeFlair.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const declarationOf = (list, key) => manifest[list].find((entry) => entry.key === key);
const keysOf = (list) => (list ?? []).map((entry) => entry.key);

async function start() {
  const fake = createFakeFlair();
  const gladys = createFakeGladys({ config: CREDENTIALS });
  const app = registerHandlers(gladys, { hub: fake.createHub() });
  await gladys.connect();
  return { gladys, fake, ...app };
}

const stop = async ({ gladys, sync }) => {
  sync.stop();
  await gladys.disconnect();
};

function assertDeclaredData(event) {
  const trigger = declarationOf('scene_triggers', event.key);
  const declared = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
  for (const [key, value] of Object.entries(event.data)) {
    assert.ok(declared.includes(key), `data.${key} is not declared, the core would drop it`);
    assert.ok(value === null || typeof value !== 'object', `data.${key} must be a primitive`);
  }
  for (const field of trigger.fields.filter((f) => f.options)) {
    assert.ok(
      field.options.some((option) => option.value === event.data[field.key]),
      `data.${field.key} "${event.data[field.key]}" must be one of the filter options`,
    );
  }
}

test('the first refresh fires nothing: it only sets the reference', async () => {
  const ctx = await start();
  try {
    assert.equal(ctx.gladys.fake.sceneEvents.length, 0);
  } finally {
    await stop(ctx);
  }
});

test('home -> away in the Flair app fires home_away_changed once', async () => {
  const ctx = await start();
  try {
    ctx.fake.set('structures', 's1', { home: false });
    await ctx.sync.run();
    await ctx.sync.run();
    const events = ctx.gladys.fake.sceneEvents;
    assert.equal(events.length, 1);
    assert.equal(events[0].key, TRIGGERS.HOME_AWAY_CHANGED);
    assert.equal(events[0].data.mode, 'away');
    assert.equal(events[0].data.device, ctx.gladys.externalIds('structure', 's1').device);
    assertDeclaredData(events[0]);
  } finally {
    await stop(ctx);
  }
});

test('a home/away change made by Gladys does not trigger the scenes again', async () => {
  const ctx = await start();
  try {
    const ack = await ctx.gladys.fake.sceneAction('set_home_away', {
      device: ctx.gladys.externalIds('structure', 's1').device,
      mode: 'away',
    });
    assert.equal(ack.success, true);
    await ctx.sync.run();
    assert.equal(ctx.gladys.fake.sceneEvents.length, 0);
  } finally {
    await stop(ctx);
  }
});

test('a vent going offline then back fires device_connectivity_changed', async () => {
  const ctx = await start();
  try {
    ctx.fake.set('vents', 'v2', { inactive: true });
    await ctx.sync.run();
    ctx.fake.set('vents', 'v2', { inactive: false });
    await ctx.sync.run();
    const events = ctx.gladys.fake.sceneEvents;
    assert.deepEqual(
      events.map((e) => [e.key, e.data.status]),
      [
        [TRIGGERS.CONNECTIVITY_CHANGED, 'offline'],
        [TRIGGERS.CONNECTIVITY_CHANGED, 'online'],
      ],
    );
    assert.equal(events[0].data.device_name, 'Salon vent 2');
    events.forEach(assertDeclaredData);
  } finally {
    await stop(ctx);
  }
});

test('detectSceneEvents ignores devices that just appeared', async () => {
  const gladys = createFakeGladys();
  const hub = await refreshedHub();
  const previous = { ...hub.snapshot, vents: [] };
  assert.deepEqual(detectSceneEvents(gladys, previous, hub.snapshot), []);
  assert.deepEqual(detectSceneEvents(gladys, null, hub.snapshot), []);
});

test('set_vent_position moves the vent and returns the declared outputs', async () => {
  const ctx = await start();
  try {
    const ack = await ctx.gladys.fake.sceneAction('set_vent_position', {
      device: ctx.gladys.externalIds('vent', 'v1').device,
      position: 40,
    });
    assert.equal(ack.success, true);
    assert.deepEqual(ack.data.outputs, { position: 40, auto_mode: true });
    assert.equal(ctx.fake.data.vents[0].attributes['percent-open'], 40);
  } finally {
    await stop(ctx);
  }
});

test('set_room_set_point and set_auto_mode return their outputs', async () => {
  const gladys = createFakeGladys();
  const hub = await refreshedHub();
  assert.deepEqual(
    await SCENE_ACTIONS.set_room_set_point(gladys, {
      fields: { device: gladys.externalIds('room', 'r1').device, temperature: 19 },
      hub,
    }),
    { set_point: 19 },
  );
  assert.deepEqual(
    await SCENE_ACTIONS.set_auto_mode(gladys, {
      fields: { device: gladys.externalIds('structure', 's1').device, enabled: false },
      hub,
    }),
    { auto_mode: false },
  );
});

test('every scene action output is declared in the manifest', async () => {
  const gladys = createFakeGladys();
  const hub = await refreshedHub();
  const calls = {
    set_vent_position: { device: gladys.externalIds('vent', 'v1').device, position: 0 },
    set_room_set_point: { device: gladys.externalIds('room', 'r1').device, temperature: 20 },
    set_home_away: { device: gladys.externalIds('structure', 's1').device, mode: 'home' },
    set_auto_mode: { device: gladys.externalIds('structure', 's1').device, enabled: true },
  };
  for (const [key, fields] of Object.entries(calls)) {
    const outputs = await SCENE_ACTIONS[key](gladys, { fields, hub });
    const declared = keysOf(declarationOf('scene_actions', key).outputs);
    assert.deepEqual(Object.keys(outputs).sort(), [...declared].sort(), `outputs of ${key}`);
  }
});

test('a device of the wrong kind fails the action with a clear message', async () => {
  const gladys = createFakeGladys();
  const hub = await refreshedHub();
  await assert.rejects(
    SCENE_ACTIONS.set_vent_position(gladys, {
      fields: { device: gladys.externalIds('puck', 'p1').device, position: 50 },
      hub,
    }),
    /not a Flair vent/,
  );
});
