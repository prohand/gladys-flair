# Gladys Flair

[Gladys Assistant](https://gladysassistant.com) external integration for
[Flair](https://flair.co) Smart Vents and Pucks, through the Flair **cloud** API.

- **Devices**: one per Flair home (Home/Away, Auto/Manual), room (set point,
  temperature, humidity, Active), Smart Vent (opening 0–100 %, open/close) and
  Puck (temperature, humidity).
- **Transport badge**: `cloud` on every device, `unreachable` when Flair does
  not answer or flags a vent or puck inactive (manifest `transports: ["cloud"]`).
- **Scene triggers**: home switched Home/Away, vent or puck offline/online.
- **Scene actions**: set a vent opening, a room set point, Home/Away,
  Auto/Manual.
- **Dashboard widget**: "Flair overview".
- **Languages**: English, French, German, Spanish (manifest, messages, docs).

Requires **Gladys 5.3.0** or later and Flair API credentials (client ID and
client secret, given by Flair support on request).

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## How it works

```
Gladys  <── SDK (WebSocket + host API) ──>  this container  ── HTTPS ──>  api.flair.co
```

- **Auth**: OAuth 2.0 client credentials (`POST /oauth2/token`). The token is
  kept in memory, shared by parallel requests and renewed before it expires.
- **Refresh**: every `poll_frequency` seconds (120 by default, 60 minimum),
  four requests read the whole account (`/api/structures`, `/api/rooms`,
  `/api/vents`, `/api/pucks`). Only the changed values are sent to Gladys
  (`publishChangedStates`, 30-minute heartbeat).
- **Orders**: `PATCH /api/<type>/<id>` (`percent-open`, `set-point-c`,
  `active`, `home`, `mode`), then the confirmed value is published at once.
- **Triggers**: found by comparing two refreshes. The first refresh after a
  start fires nothing, and a change made from Gladys is never read back as an
  event.

## Project structure

```
.
├─ index.js                     # SDK bootstrap (connect, shutdown)
├─ src/
│  ├─ app.js                    # every Gladys handler
│  ├─ config.js                 # config defaults + normalization
│  ├─ i18n.js                   # en / fr / de / es helpers
│  ├─ sync.js                   # refresh loop
│  ├─ flair/
│  │  ├─ client.js              # Flair API client (OAuth2, JSON:API)
│  │  └─ hub.js                 # last snapshot of the account
│  ├─ devices/                  # structure, room, vent, puck blueprints
│  └─ capabilities/
│     ├─ actions.js             # "Test the connection"
│     ├─ triggers.js            # scene triggers
│     ├─ scenes.js              # scene actions
│     └─ widget.js              # dashboard widget
├─ docs/{en,fr,de,es}.md        # user documentation (re-hosted by Gladys)
├─ test/                        # node --test, no network
├─ gladys-assistant-integration.json
├─ Dockerfile                   # Node 24 Alpine, read-only rootfs ready
├─ CHANGELOG.md · CLAUDE.md · SECURITY.md
└─ .github/
   ├─ workflows/ci.yml          # format, lint, tests (Node 22 + 24), store checks, Docker build
   ├─ workflows/release.yml     # UI-driven release: bump + changelog + tag + build
   ├─ workflows/build.yml       # multi-arch image (amd64 + arm64) to ghcr.io
   ├─ workflows/github-release.yml # GitHub Release of every version tag
   ├─ scripts/changelog-release.mjs
   └─ dependabot.yml
```

## Development

```bash
npm install
npm test
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store --skip-image-check .
```

Run it against a Gladys instance:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="flair" \
LOG_LEVEL=debug \
npm start
```

The tests use the fake Gladys of the SDK (`createFakeGladys`) and an in-memory
Flair cloud (`test/helpers/fakeFlair.js`): no network, no credentials.

## Release

1. Describe the changes under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md).
2. **Actions → Release → Run workflow**, pick `patch`, `minor` or `major`.

The workflow bumps `package.json`, `package-lock.json` and the manifest
(`version` + `docker_image`), rolls the changelog, tags `vX.Y.Z`, builds the
`linux/amd64` + `linux/arm64` image to `ghcr.io/prohand/gladys-flair`
(`:X.Y.Z` and `:latest`), publishes the GitHub Release and runs the store
checks. Never edit the versions by hand.

For the store, the repository needs the GitHub topic
`gladys-assistant-integration`, and the ghcr.io package must be public.

## License

Apache-2.0
