# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and to human contributors when
working with code in this repository.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step, one runtime
dependency: `@gladysassistant/integration-sdk`) for **Flair**: Smart Vents, Pucks, rooms and
homes, through the Flair **cloud** API (`https://api.flair.co`, OAuth 2.0 client credentials,
JSON:API). Requires Gladys 5.3+. Started from the official template
(GladysAssistant/integration-template-js); the workflows follow prohand/gladys-devmel.

Gladys gets one device per Flair home (Home/Away, Auto/Manual), room (set point, temperature,
humidity, Active), vent (opening 0–100 %, open/close) and puck (temperature, humidity). Scene
triggers (home/away changed, device online/offline), scene actions (vent opening, room set point,
Home/Away, Auto/Manual) and a "Flair overview" widget.

## Commands

```bash
npm install
npm test                                    # node --test (built-in runner)
node --test test/devices.test.js            # one file
node --test --test-name-pattern "vent"      # tests whose name matches
npm run lint                                # eslint .
npm run format:check                        # prettier --check . (CI gate)
npm run format                              # prettier --write .
npx github:GladysAssistant/integration-store --skip-image-check .   # store admission checks
```

CI runs `format:check`, `lint`, `test` on Node 22 and 24; pull requests also run the store
checks and build the image. Run the three commands before pushing.

## Architecture

```
index.js                    SDK bootstrap only (connect, shutdown)
src/app.js                  every Gladys handler, registered before connect()
src/config.js               DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/i18n.js                 LANGUAGES (en, fr, de, es), localize / pick
src/flair/client.js         Flair API: token, list (pagination), update (PATCH), errors
src/flair/hub.js            last snapshot of the account + update() merged into it
src/sync.js                 refresh loop: discovery, changed states, transports, triggers, status
src/devices/                one blueprint per Flair resource (structure, room, vent, puck)
src/capabilities/actions.js manifest `actions` (Test the connection)
src/capabilities/triggers.js scene triggers, found by diffing two refreshes
src/capabilities/scenes.js  scene actions
src/capabilities/widget.js  dashboard widget
docs/{en,fr,de,es}.md       user documentation, re-hosted by Gladys
test/                       node --test, fake Gladys of the SDK + test/helpers/fakeFlair.js
.github/scripts/changelog-release.mjs   CHANGELOG roll, run by the Release workflow
```

### Invariants worth knowing

- **External ids are forever**: `gladys.externalIds(kind, flairId)` with `kind` in
  `structure | room | vent | puck` and the Flair resource id. Never rename a kind, a feature
  key, a manifest key (config, action, trigger, scene action, widget): users store them.
- **Cloud only.** Manifest `transports: ["cloud"]`; the badge is `cloud` when Flair answered
  and the device is active, `unreachable` otherwise.
- **One refresh = four requests** (`structures`, `rooms`, `vents`, `pucks`) whatever the size
  of the home, on our own timer (`poll_frequency`, seconds, 60–3600). Gladys' per-device
  `onPoll` is not used: no device declares `poll_frequency`.
- **One token for parallel requests** (`pendingToken`): a second token request would revoke the
  first one. A 401 renews the token once.
- **Orders are merged into the snapshot** (`FlairHub.update`): Gladys sees the value at once and
  the next refresh does not read the change as an external event — a scene that sets the home
  away is never re-triggered by itself.
- **The first refresh after a start fires no trigger**: it only sets the reference.
- In **Auto mode** Flair moves the vents itself: a position set from Gladys may not last (logged,
  and returned as `auto_mode` by the scene action).
- **Every feature declares `min`/`max`.** Unknown readings (a room without puck) are not
  published, never sent as 0.
- **The container rootfs is read-only**: write only under `/data` (the integration currently
  writes nothing). Never log the client secret nor the token.

## Rules

- **Versions belong to the Release workflow** (Actions → Release). Never edit `version` in
  `package.json` or the manifest, nor the `docker_image` tag, by hand. `test/manifest.test.js`
  checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]` in
  `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`). Never write a version
  heading: the Release workflow moves the section.
- **Manifest.** Every `label`, `description` and `placeholder` is `{ en, fr, de, es }`
  (`test/manifest.test.js` enforces it). Catalog `description`: 10 to 100 characters per
  language. `keywords` need `gladys_version >=5.3.0`.
- **User-facing text** (action answers, connection status, widget) is `{ en, fr, de, es }`, built
  with `src/i18n.js`. Docs in `docs/en.md`, `docs/fr.md`, `docs/de.md`, `docs/es.md`, kept in
  sync.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why, in English. Tests
  never touch the network.
