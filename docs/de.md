# Flair

Steuere deine [Flair](https://flair.co) Smart Vents (smarte Lüftungsklappen)
aus Gladys, verfolge die Temperatur jedes Raums und schalte dein Zuhause
zwischen Zuhause und Abwesend um.

## Was du bekommst

Nach der Konfiguration listet der Tab **Erkennung** ein Gerät pro
Flair-Element:

| Flair-Element | In Gladys                                                                  |
| ------------- | -------------------------------------------------------------------------- |
| Zuhause       | Schalter **Zuhause** (aus = Abwesend), **Auto-Modus** (aus = Manuell)      |
| Raum          | **Sollwert** (Thermostat), **Temperatur**, **Luftfeuchtigkeit**, **Aktiv** |
| Smart Vent    | **Öffnung** (0 % zu bis 100 % offen) und die Tasten Öffnen / Schließen     |
| Puck          | **Temperatur**, **Luftfeuchtigkeit**                                       |

Jedes Gerät zeigt ein **Cloud**-Abzeichen: Flair ist nur über seine Cloud
erreichbar. Das Abzeichen wechselt auf **nicht erreichbar**, wenn Flair nicht
antwortet oder wenn sich eine Klappe oder ein Puck nicht mehr meldet (leere
Batterie, außer Reichweite).

## Vorab: API-Zugangsdaten besorgen

Flair gibt den API-Zugang auf Anfrage frei: Schreibe dem Flair-Support (über
die Flair-Website oder die Flair-App) und bitte um **API-Zugangsdaten** für
dein Konto. Du erhältst eine **Client-ID** und ein **Client-Secret**.

## Konfiguration

1. Öffne den Tab **Konfiguration** der Integration.
2. Füge die **Client-ID** und das **Client-Secret** ein.
3. Ändere bei Bedarf das **Aktualisierungsintervall**: Die Integration liest
   dein Flair-Konto standardmäßig alle 2 Minuten (mindestens eine Minute).
4. Speichere und klicke auf **Verbindung testen**: Die Antwort listet die
   gefundenen Zuhause, Räume, Klappen und Pucks.
5. Öffne den Tab **Erkennung** und füge die gewünschten Geräte hinzu.

## Gut zu wissen

- Im **Auto**-Modus öffnet und schließt Flair die Klappen selbst, um den
  Sollwert jedes Raums zu erreichen. Eine in Gladys gesetzte Öffnung hält bis
  zur nächsten Entscheidung von Flair. Damit die Klappen bleiben, wo du sie
  hinstellst, schalte das Zuhause auf **Manuell** (Schalter **Auto-Modus**).
- Ein **inaktiver** Raum wird von Flair ausgelassen: Seine Klappen bleiben
  geschlossen.
- Eine Änderung in der Flair-App erscheint bei der nächsten Aktualisierung in
  Gladys.

## Szenen

Die Integration fügt dem Szenen-Editor eigene Karten hinzu, in der Kategorie
**Integrationen**.

Auslöser:

- **Flair Zuhause/Abwesend geändert** — ein Zuhause wechselte zwischen
  Zuhause und Abwesend (Flair-App, Geofencing oder Gladys … außer einer
  Änderung durch dieselbe Szene). Wähle optional das Zuhause und den neuen
  Modus. Die folgenden Aktionen können `{{triggerEvent.data.mode}}` (`home`
  oder `away`) und `{{triggerEvent.data.home_name}}` lesen.
- **Flair-Gerät online oder offline** — eine Klappe oder ein Puck meldet sich
  nicht mehr oder ist zurück. Wähle optional das Gerät und den Status.
  Variablen: `{{triggerEvent.data.status}}` (`offline` oder `online`) und
  `{{triggerEvent.data.device_name}}`.

Aktionen:

- **Öffnung einer Flair-Klappe setzen** — 0 bis 100 %. Gibt die Öffnung
  zurück und ob das Zuhause im Auto-Modus ist (Flair kann die Klappe dann
  wieder verstellen).
- **Sollwert eines Flair-Raums setzen** — 10 bis 32 °C. Gibt den Sollwert
  zurück.
- **Flair-Zuhause auf Zuhause oder Abwesend setzen** — gibt zurück, ob das
  Zuhause auf Zuhause steht.
- **Flair-Zuhause auf Auto oder Manuell setzen** — gibt zurück, ob Auto aktiv
  ist.

## Dashboard

Füge das Widget **Flair-Übersicht** einem Dashboard hinzu. Es zeigt die
durchschnittliche Raumtemperatur, die Zahl der offenen Klappen, die
Offline-Geräte, dann jedes Zuhause (Zuhause / Abwesend, Auto / Manuell) und
jeden Raum (Temperatur → Sollwert, grün wenn nah, orange oder rot wenn weit
entfernt). Seine Tasten schalten das erste Zuhause zwischen Zuhause und
Abwesend, zwischen Auto und Manuell um und aktualisieren die Daten sofort.

## Fehlerbehebung

- **„Flair hat die API-Zugangsdaten abgelehnt“** — prüfe Client-ID und
  Client-Secret, ohne Leerzeichen davor oder danach. Wende dich an den
  Flair-Support, wenn es weiterhin scheitert.
- **„Die Flair-Cloud antwortet nicht“** — Flair oder deine
  Internetverbindung ist ausgefallen. Die Integration versucht es bei jeder
  Aktualisierung erneut.
- **Ein Gerät bleibt nicht erreichbar** — prüfe in der Flair-App seine
  Batterie und seinen Abstand zur Flair-Bridge.
- Mehr Details in den Logs der Integration (Gladys-Oberfläche oder
  `docker logs` auf dem Host), mit `LOG_LEVEL=debug`.
