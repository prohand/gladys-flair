# Flair

Control your [Flair](https://flair.co) Smart Vents from Gladys, follow the
temperature of every room, and switch your home between Home and Away.

## What you get

After the configuration, the **Discovery** tab lists one device per Flair item:

| Flair item | In Gladys                                                             |
| ---------- | --------------------------------------------------------------------- |
| Home       | **Home** switch (off = Away), **Auto mode** switch (off = Manual)     |
| Room       | **Set point** (thermostat), **Temperature**, **Humidity**, **Active** |
| Smart Vent | **Opening** (0 % closed to 100 % open) and the open / close buttons   |
| Puck       | **Temperature**, **Humidity**                                         |

Each device shows a **cloud** badge: Flair is reached through its cloud only.
The badge turns **unreachable** when Flair does not answer, or when a vent or
a puck stops reporting (empty battery, out of range).

## Before you start: get your API credentials

Flair gives API access on request: write to Flair support (from the Flair
website or the Flair app) and ask for **API credentials** for your account.
You receive a **client ID** and a **client secret**.

## Configuration

1. Open the **Configuration** tab of the integration.
2. Paste the **Client ID** and the **Client secret**.
3. Optionally change the **Refresh interval**: the integration reads your
   Flair account every 2 minutes by default (one minute minimum).
4. Save, then press **Test the connection**: the answer lists the homes,
   rooms, vents and pucks found.
5. Open the **Discovery** tab and add the devices you want.

## Good to know

- In **Auto** mode, Flair opens and closes the vents itself to reach the set
  point of each room. A vent opening set from Gladys holds until Flair's next
  decision. To keep the vents where you put them, switch the home to
  **Manual** (the **Auto mode** switch).
- An **inactive** room is left aside by Flair: its vents stay closed.
- A change made in the Flair app shows in Gladys at the next refresh.

## Scenes

The integration adds its own cards to the scene editor, in the
**Integrations** category.

Triggers:

- **Flair home or away changed** — a home switched between Home and Away
  (Flair app, geofencing or Gladys itself... except a change made by the same
  scene). Optionally pick the home and the new mode. The next actions can
  read `{{triggerEvent.data.mode}}` (`home` or `away`) and
  `{{triggerEvent.data.home_name}}`.
- **Flair device online or offline** — a vent or a puck stopped reporting,
  or came back. Optionally pick the device and the status. Variables:
  `{{triggerEvent.data.status}}` (`offline` or `online`) and
  `{{triggerEvent.data.device_name}}`.

Actions:

- **Set a Flair vent opening** — 0 to 100 %. Returns the opening and whether
  the home is in Auto mode (Flair may then move the vent again).
- **Set a Flair room set point** — 10 to 32 °C. Returns the set point.
- **Set a Flair home to Home or Away** — returns whether the home is Home.
- **Set a Flair home to Auto or Manual** — returns whether Auto is on.

## Dashboard

Add the **Flair overview** widget to a dashboard. It shows the average room
temperature, the number of open vents, the devices offline, then each home
(Home / Away, Auto / Manual) and each room (temperature → set point, green
when close, orange or red when far). Its buttons switch the first home
between Home and Away, between Auto and Manual, and refresh the data now.

## Troubleshooting

- **"Flair refused the API credentials"** — check the client ID and the
  client secret, with no space around them. Ask Flair support if they still
  fail.
- **"The Flair cloud does not answer"** — Flair or your Internet connection
  is down. The integration tries again at every refresh.
- **A device stays unreachable** — check its battery and its distance to the
  Flair bridge in the Flair app.
- More detail in the integration logs (Gladys interface, or `docker logs` on
  the host), with `LOG_LEVEL=debug`.
