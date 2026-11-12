// -----------------------------------------------------------------------------
// Manifest `actions`: the buttons of the Configuration screen.
//
// The resolved message is shown under the button, in the reader's language.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { localize, pick } from '../i18n.js';
import { STATUS_MESSAGES } from '../sync.js';

const logger = createLogger({ name: 'actions' });

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const WORDS = {
  en: {
    home: ['home', 'homes'],
    room: ['room', 'rooms'],
    vent: ['vent', 'vents'],
    puck: ['puck', 'pucks'],
  },
  fr: {
    home: ['maison', 'maisons'],
    room: ['pièce', 'pièces'],
    vent: ['bouche', 'bouches'],
    puck: ['puck', 'pucks'],
  },
  de: {
    home: ['Zuhause', 'Zuhause'],
    room: ['Raum', 'Räume'],
    vent: ['Klappe', 'Klappen'],
    puck: ['Puck', 'Pucks'],
  },
  es: {
    home: ['casa', 'casas'],
    room: ['habitación', 'habitaciones'],
    vent: ['rejilla', 'rejillas'],
    puck: ['puck', 'pucks'],
  },
};

const CONNECTED = {
  en: 'Connected to Flair',
  fr: 'Connecté à Flair',
  de: 'Mit Flair verbunden',
  es: 'Conectado a Flair',
};
const OFFLINE = { en: 'offline', fr: 'hors ligne', de: 'offline', es: 'sin conexión' };

/** "Connected to Flair: 1 home, 4 rooms, 6 vents, 3 pucks (1 offline)." */
export function connectionReport(counts) {
  return localize((language) => {
    const words = WORDS[language] ?? WORDS.en;
    const parts = [
      plural(counts.structures, ...words.home),
      plural(counts.rooms, ...words.room),
      plural(counts.vents, ...words.vent),
      plural(counts.pucks, ...words.puck),
    ].join(', ');
    const offline = counts.offline > 0 ? ` (${counts.offline} ${pick(language, OFFLINE)})` : '';
    // French puts a space before the colon.
    const colon = language === 'fr' ? ' :' : ':';
    return `${pick(language, CONNECTED)}${colon} ${parts}${offline}.`;
  });
}

export const ACTIONS = {
  // A refresh like the loop's, with the discovery list published again: the
  // devices appear in the Discovery tab right after.
  async test_connection(gladys, { sync }) {
    logger.info('Action test_connection');
    const result = await sync.run({ publishDevices: true });
    if (result.ok) {
      return connectionReport(result.counts);
    }
    if (result.reason === 'missing-credentials') {
      return STATUS_MESSAGES.missingCredentials;
    }
    return result.reason === 'auth' ? STATUS_MESSAGES.authRefused : STATUS_MESSAGES.unreachable;
  },
};
