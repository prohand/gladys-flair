import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import {
  applyCommand,
  buildDiscoveredDevices,
  buildStates,
  buildTransportEntries,
  resolveDevice,
} from '../src/devices/index.js';
import { clampSetPoint } from '../src/devices/room.js';
import { clampPosition } from '../src/devices/vent.js';
import { createFakeFlair, refreshedHub } from './helpers/fakeFlair.js';

const ids = (gladys, kind, id) => gladys.externalIds(kind, id);

test('one device per Flair resource, accepted by Gladys', async () => {
  const gladys = createFakeGladys();
  const hub = await refreshedHub();
  const devices = buildDiscoveredDevices(gladys, hub);
  assert.equal(devices.length, 1 + 2 + 3 + 2);
  // The fake Gladys refuses what the host API refuses (category, type, unit...).
  await gladys.publishDiscoveredDevices(devices);
  assert.equal(gladys.fake.discoveredDevices.length, devices.length);
});

test('every feature declares min and max, and every external id is unique', async () => {
  const gladys = createFakeGladys();
  const hub = await refreshedHub();
  const seen = new Set();
  for (const device of buildDiscoveredDevices(gladys, hub)) {
    for (const feature of device.features) {
      assert.equal(typeof feature.min, 'number', `${feature.external_id}: min`);
      assert.equal(typeof feature.max, 'number', `${feature.external_id}: max`);
      assert.ok(!seen.has(feature.external_id), `duplicate ${feature.external_id}`);
      seen.add(feature.external_id);
    }
  }
});

test('states mirror the Flair attributes and skip unknown readings', async () => {
  const gladys = createFakeGladys();
  const hub = await refreshedHub();
  const states = Object.fromEntries(
    buildStates(gladys, hub).map((s) => [s.device_feature_external_id, s.state]),
  );
  assert.equal(states[ids(gladys, 'structure', 's1').feature('home')], 1);
  assert.equal(states[ids(gladys, 'structure', 's1').feature('auto-mode')], 1);
  assert.equal(states[ids(gladys, 'room', 'r1').feature('set-point')], 21);
  assert.equal(states[ids(gladys, 'room', 'r1').feature('temperature')], 20.4);
  assert.equal(states[ids(gladys, 'room', 'r2').feature('active')], 0);
  assert.equal(states[ids(gladys, 'vent', 'v2').feature('position')], 50);
  assert.equal(states[ids(gladys, 'vent', 'v2').feature('state')], 1);
  assert.equal(states[ids(gladys, 'vent', 'v3').feature('state')], -1);
  // The bedroom has no puck reading: nothing published rather than a 0.
  assert.ok(!(ids(gladys, 'room', 'r2').feature('temperature') in states));
  await gladys.publishStates(buildStates(gladys, hub));
});

test('transports: cloud when Flair answers, unreachable for an inactive device', async () => {
  const gladys = createFakeGladys();
  const hub = await refreshedHub();
  const byId = (entries) => Object.fromEntries(entries.map((e) => [e.external_id, e.transport]));
  const online = byId(buildTransportEntries(gladys, hub, { cloudReachable: true }));
  assert.equal(online[ids(gladys, 'vent', 'v1').device], DEVICE_TRANSPORTS.CLOUD);
  assert.equal(online[ids(gladys, 'puck', 'p2').device], DEVICE_TRANSPORTS.UNREACHABLE);
  const down = byId(buildTransportEntries(gladys, hub, { cloudReachable: false }));
  assert.ok(Object.values(down).every((t) => t === DEVICE_TRANSPORTS.UNREACHABLE));
  await gladys.publishTransports(buildTransportEntries(gladys, hub, { cloudReachable: true }));
});

test('resolveDevice finds the resource behind an external id', async () => {
  const gladys = createFakeGladys();
  const hub = await refreshedHub();
  assert.equal(resolveDevice(gladys, hub, ids(gladys, 'vent', 'v2').device).resource.id, 'v2');
  assert.equal(resolveDevice(gladys, hub, ids(gladys, 'vent', 'nope').device), null);
  assert.equal(resolveDevice(gladys, hub, 'ext:other:vent:v2'), null);
});

async function command(kind, id, featureKey, value, fake = createFakeFlair()) {
  const gladys = createFakeGladys();
  const hub = await refreshedHub(fake);
  const deviceIds = ids(gladys, kind, id);
  await applyCommand(gladys, hub, {
    deviceExternalId: deviceIds.device,
    featureExternalId: deviceIds.feature(featureKey),
    value,
  });
  const patch = fake.requests.find((r) => r.method === 'PATCH');
  return { gladys, hub, fake, patch, deviceIds };
}

test('a vent position is sent to Flair and confirmed to Gladys', async () => {
  const { patch, gladys, deviceIds, hub } = await command('vent', 'v1', 'position', 30);
  assert.equal(patch.path, '/api/vents/v1');
  assert.deepEqual(patch.body.data.attributes, { 'percent-open': 30 });
  assert.equal(gladys.fake.lastState(deviceIds.feature('position')), 30);
  assert.equal(hub.get('vents', 'v1').attributes['percent-open'], 30, 'snapshot updated');
});

test('the shutter buttons open fully, close fully, and STOP sends nothing', async () => {
  assert.deepEqual((await command('vent', 'v3', 'state', 1)).patch.body.data.attributes, {
    'percent-open': 100,
  });
  assert.deepEqual((await command('vent', 'v1', 'state', -1)).patch.body.data.attributes, {
    'percent-open': 0,
  });
  assert.equal((await command('vent', 'v1', 'state', 0)).patch, undefined);
});

test('a room set point is clamped and rounded to the half degree', async () => {
  const { patch } = await command('room', 'r1', 'set-point', 21.3);
  assert.deepEqual(patch.body.data.attributes, { 'set-point-c': 21.5 });
  assert.equal(clampSetPoint(50), 32);
  assert.equal(clampSetPoint(2), 10);
  assert.throws(() => clampSetPoint('abc'));
  assert.equal(clampPosition(-5), 0);
  assert.equal(clampPosition(42.6), 43);
});

test('the home switches send home/away and auto/manual', async () => {
  assert.deepEqual((await command('structure', 's1', 'home', 0)).patch.body.data.attributes, {
    home: false,
  });
  assert.deepEqual((await command('structure', 's1', 'auto-mode', 0)).patch.body.data.attributes, {
    mode: 'manual',
  });
  assert.deepEqual((await command('room', 'r2', 'active', 1)).patch.body.data.attributes, {
    active: true,
  });
});

test('a puck is read-only: a command fails and nothing reaches Flair', async () => {
  const fake = createFakeFlair();
  await assert.rejects(command('puck', 'p1', 'temperature', 20, fake), /read-only/);
  assert.equal(
    fake.requests.find((r) => r.method === 'PATCH'),
    undefined,
  );
});

test('a refused order fails the command and leaves the snapshot as it was', async () => {
  const fake = createFakeFlair();
  const gladys = createFakeGladys();
  const hub = await refreshedHub(fake);
  const deviceIds = ids(gladys, 'vent', 'v1');
  fake.failNext(500);
  await assert.rejects(
    applyCommand(gladys, hub, {
      deviceExternalId: deviceIds.device,
      featureExternalId: deviceIds.feature('position'),
      value: 0,
    }),
  );
  assert.equal(hub.get('vents', 'v1').attributes['percent-open'], 100);
});
