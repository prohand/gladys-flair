# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- First version of the Flair integration, built from the official Gladys
  integration template (SDK 0.16, Gladys 5.3 or later).
- Flair cloud API client: OAuth 2.0 client credentials, token shared by
  parallel requests and renewed before it expires, JSON:API pagination.
- One Gladys device per Flair home, room, Smart Vent and Puck:
  - home: Home/Away and Auto/Manual switches;
  - room: set point (thermostat), temperature, humidity, Active switch;
  - vent: opening (0–100 %) and open/close buttons;
  - puck: temperature and humidity.
- Refresh loop (2 minutes by default, one minute minimum): four requests for
  the whole account, only the changed values are sent to Gladys.
- `cloud` transport badge on every device, `unreachable` when Flair does not
  answer or flags a vent or puck inactive.
- Scene triggers: a home switched between Home and Away; a vent or puck
  went offline or came back.
- Scene actions: set a vent opening, set a room set point, set a home to
  Home/Away, set a home to Auto/Manual.
- "Flair overview" dashboard widget: average temperature, vents open,
  offline devices, homes and rooms, Home/Away, Auto/Manual and Refresh
  buttons.
- "Test the connection" button in the Configuration screen.
- Texts and user documentation in English, French, German and Spanish.
- CI (Prettier, ESLint, tests on Node 22 and 24, store checks, Docker
  build), Release workflow, GitHub Releases, Dependabot.
- `SECURITY.md` and `CLAUDE.md`.

[Unreleased]: https://github.com/prohand/gladys-flair/commits/main
