import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import {
  OVERVIEW_WIDGET,
  WIDGETS,
  buildOverviewContent,
  refreshWidgets,
} from '../src/capabilities/widget.js';
import { FlairHub } from '../src/flair/hub.js';
import { CREDENTIALS, createFakeFlair, refreshedHub } from './helpers/fakeFlair.js';

const gladys = createFakeGladys();

test('the overview is rendered exactly as sent', async () => {
  const hub = await refreshedHub();
  for (const units of ['metric', 'imperial']) {
    const content = buildOverviewContent(gladys, hub, { units });
    // [] = nothing the core would drop, truncate or trim to the budget.
    assert.deepEqual(validateWidgetContent(content), []);
  }
});

test('the overview shows the rooms, the vents open and the offline devices', async () => {
  const hub = await refreshedHub();
  const content = buildOverviewContent(gladys, hub, { units: 'metric' });
  const tiles = content.components.filter((c) => c.type === 'value');
  assert.equal(tiles.find((t) => t.icon === 'wind').value, '2/3');
  assert.equal(tiles.find((t) => t.icon === 'wifi-off').value, 1);
  const status = content.components.find((c) => c.type === 'status');
  assert.equal(status.items.length, 3, 'one home + two rooms');
  assert.equal(status.items[1].value, '20.4 °C → 21 °C');
  const imperial = buildOverviewContent(gladys, hub, { units: 'imperial' });
  assert.match(imperial.components.find((c) => c.type === 'status').items[1].value, /°F/);
});

test('empty states are valid too: not configured, not refreshed yet, cloud down', async () => {
  const empty = new FlairHub();
  assert.deepEqual(validateWidgetContent(buildOverviewContent(gladys, empty)), []);
  const waiting = createFakeFlair().createHub();
  waiting.configure(CREDENTIALS);
  assert.deepEqual(validateWidgetContent(buildOverviewContent(gladys, waiting)), []);
  const down = await refreshedHub();
  down.lastError = new Error('down');
  const content = buildOverviewContent(gladys, down);
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].type, 'text');
});

test('every button of the overview is handled and answers a short toast', async () => {
  const fake = createFakeFlair();
  const fakeGladys = createFakeGladys({ config: CREDENTIALS });
  const app = registerHandlers(fakeGladys, { hub: fake.createHub() });
  await fakeGladys.connect();
  try {
    const content = buildOverviewContent(fakeGladys, app.hub);
    const buttons = content.components.filter((c) => c.type === 'button');
    assert.equal(buttons.length, 3);
    for (const { action } of buttons) {
      const ack = await fakeGladys.fake.widgetAction(OVERVIEW_WIDGET, action.key, action.params);
      assert.equal(ack.success, true, `${action.key}: ${ack.error}`);
    }
    assert.equal(fake.data.structures[0].attributes.home, false, 'Set away was sent');
    assert.equal(fake.data.structures[0].attributes.mode, 'manual', 'Manual mode was sent');
  } finally {
    app.sync.stop();
    await fakeGladys.disconnect();
  }
});

test('the widget content goes through onWidgetGet', async () => {
  const fake = createFakeFlair();
  const fakeGladys = createFakeGladys({ config: CREDENTIALS });
  const app = registerHandlers(fakeGladys, { hub: fake.createHub() });
  await fakeGladys.connect();
  try {
    const ack = await fakeGladys.fake.widgetGet(OVERVIEW_WIDGET);
    assert.equal(ack.success, true);
  } finally {
    app.sync.stop();
    await fakeGladys.disconnect();
  }
});

test('an unknown widget action fails, so the user sees the error', async () => {
  const hub = await refreshedHub();
  await assert.rejects(
    WIDGETS[OVERVIEW_WIDGET].action(gladys, { actionKey: 'unknown', params: {}, hub }),
    /Unknown widget action/,
  );
});

test('refreshWidgets nudges every widget', () => {
  const fresh = createFakeGladys();
  refreshWidgets(fresh);
  assert.deepEqual(fresh.fake.widgetRefreshes, Object.keys(WIDGETS));
});
