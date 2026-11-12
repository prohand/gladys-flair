// -----------------------------------------------------------------------------
// Dashboard widget (Gladys 5.1+, manifest `widgets`): "Flair overview".
//
// Computed from the last refresh, in the core's declarative vocabulary:
//   - three tiles: average room temperature, vents open, devices offline;
//   - a status list: each home (Home / Away, Auto / Manual), then the rooms
//     (temperature -> set point), at most 10 rows;
//   - buttons: Home / Away and Auto / Manual for the first home, Refresh.
//
// The button `params` are declared here and sent back as is: the handler never
// receives user input. After a successful action the core re-pulls the
// content; the refresh loop nudges it after every refresh.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { applyCommand } from '../devices/index.js';
import { STRUCTURE_FEATURES, structure } from '../devices/structure.js';
import { isInactive, nameOf, numberOrNull } from '../devices/helpers.js';
import { localize, pick } from '../i18n.js';

const logger = createLogger({ name: 'widget' });

export const OVERVIEW_WIDGET = 'flair_overview';

export const WIDGET_ACTIONS = {
  TOGGLE_HOME: 'toggle_home',
  TOGGLE_AUTO: 'toggle_auto',
  REFRESH: 'refresh',
};

const MAX_STATUS_ITEMS = 10;

const T = {
  avgTemperature: { en: 'Avg. temp.', fr: 'Temp. moy.', de: 'Ø Temp.', es: 'Temp. media' },
  ventsOpen: {
    en: 'Vents open',
    fr: 'Bouches ouvertes',
    de: 'Offene Klappen',
    es: 'Rejillas abiertas',
  },
  offline: { en: 'Offline', fr: 'Hors ligne', de: 'Offline', es: 'Sin conexión' },
  home: { en: 'Home', fr: 'Présent', de: 'Zuhause', es: 'En casa' },
  away: { en: 'Away', fr: 'Absent', de: 'Abwesend', es: 'Fuera' },
  auto: { en: 'Auto', fr: 'Auto', de: 'Auto', es: 'Auto' },
  manual: { en: 'Manual', fr: 'Manuel', de: 'Manuell', es: 'Manual' },
  inactive: { en: 'Inactive', fr: 'Inactive', de: 'Inaktiv', es: 'Inactiva' },
  setAway: { en: 'Set away', fr: 'Passer absent', de: 'Auf abwesend', es: 'Poner fuera' },
  setHome: { en: 'Set home', fr: 'Passer présent', de: 'Auf zuhause', es: 'Poner en casa' },
  setManual: { en: 'Manual mode', fr: 'Mode manuel', de: 'Manueller Modus', es: 'Modo manual' },
  setAuto: { en: 'Auto mode', fr: 'Mode auto', de: 'Auto-Modus', es: 'Modo auto' },
  refresh: { en: 'Refresh', fr: 'Rafraîchir', de: 'Aktualisieren', es: 'Actualizar' },
  notConfigured: {
    en: 'Enter your Flair API credentials in the integration configuration.',
    fr: "Saisissez vos identifiants de l'API Flair dans la configuration de l'intégration.",
    de: 'Gib deine Flair-API-Zugangsdaten in der Konfiguration der Integration ein.',
    es: 'Introduzca sus credenciales de la API de Flair en la configuración de la integración.',
  },
  noData: {
    en: 'No Flair data yet: the first refresh is on its way.',
    fr: 'Pas encore de données Flair : le premier rafraîchissement arrive.',
    de: 'Noch keine Flair-Daten: Die erste Aktualisierung läuft.',
    es: 'Aún no hay datos de Flair: la primera actualización está en camino.',
  },
  cloudDown: {
    en: 'The Flair cloud did not answer the last refresh.',
    fr: "Le cloud Flair n'a pas répondu au dernier rafraîchissement.",
    de: 'Die Flair-Cloud hat auf die letzte Aktualisierung nicht geantwortet.',
    es: 'La nube de Flair no respondió a la última actualización.',
  },
  refreshed: {
    en: 'Flair data refreshed.',
    fr: 'Données Flair rafraîchies.',
    de: 'Flair-Daten aktualisiert.',
    es: 'Datos de Flair actualizados.',
  },
  refreshFailed: {
    en: 'The Flair cloud did not answer, try again later.',
    fr: 'Le cloud Flair ne répond pas, réessayez plus tard.',
    de: 'Die Flair-Cloud antwortet nicht, versuche es später erneut.',
    es: 'La nube de Flair no responde, inténtelo más tarde.',
  },
  done: { en: 'Done.', fr: 'C’est fait.', de: 'Erledigt.', es: 'Hecho.' },
};

const text = (key) => localize((l) => pick(l, T[key]));

/** A Celsius value in the viewer's unit system. */
function formatTemperature(celsius, units) {
  if (celsius === null) {
    return '–';
  }
  if (units === 'imperial') {
    return `${Math.round(((celsius * 9) / 5 + 32) * 10) / 10} °F`;
  }
  return `${Math.round(celsius * 10) / 10} °C`;
}

function roomRow(resource, units) {
  const temperature = numberOrNull(resource.attributes?.['current-temperature-c']);
  const setPoint = numberOrNull(resource.attributes?.['set-point-c']);
  const label = nameOf(resource, 'Room').slice(0, 40);
  if (resource.attributes?.active === false) {
    return { label, icon: 'moon', value: text('inactive'), color: WIDGET_COLORS.NEUTRAL };
  }
  const gap = temperature !== null && setPoint !== null ? Math.abs(temperature - setPoint) : null;
  return {
    label,
    icon: 'thermometer',
    value: `${formatTemperature(temperature, units)} → ${formatTemperature(setPoint, units)}`,
    color:
      gap === null
        ? WIDGET_COLORS.NEUTRAL
        : gap <= 1
          ? WIDGET_COLORS.SUCCESS
          : gap <= 2.5
            ? WIDGET_COLORS.WARNING
            : WIDGET_COLORS.DANGER,
  };
}

function homeRow(resource) {
  const home = resource.attributes?.home !== false;
  const auto = resource.attributes?.mode === 'auto';
  return {
    label: nameOf(resource, 'Home').slice(0, 40),
    icon: 'home',
    value: localize(
      (l) => `${pick(l, home ? T.home : T.away)} · ${pick(l, auto ? T.auto : T.manual)}`,
    ),
    color: home ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.INFO,
  };
}

/** The widget content for the current snapshot. */
export function buildOverviewContent(gladys, hub, { units } = {}) {
  if (!hub.configured) {
    return { ttl_seconds: 300, components: [{ type: 'text', text: text('notConfigured') }] };
  }
  const { structures, rooms, vents, pucks } = hub.snapshot;
  if (!hub.lastRefreshAt) {
    return { ttl_seconds: 30, components: [{ type: 'text', text: text('noData') }] };
  }

  const temperatures = rooms
    .filter((r) => r.attributes?.active !== false)
    .map((r) => numberOrNull(r.attributes?.['current-temperature-c']))
    .filter((t) => t !== null);
  const average =
    temperatures.length > 0 ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length : null;
  const open = vents.filter((v) => numberOrNull(v.attributes?.['percent-open']) > 0).length;
  const offline = [...vents, ...pucks].filter(isInactive).length;

  const components = [];
  if (hub.lastError) {
    components.push({ type: 'text', variant: 'caption', text: text('cloudDown') });
  }
  components.push(
    {
      type: 'value',
      label: text('avgTemperature'),
      icon: 'thermometer',
      value: formatTemperature(average, units),
    },
    {
      type: 'value',
      label: text('ventsOpen'),
      icon: 'wind',
      value: `${open}/${vents.length}`,
    },
    {
      type: 'value',
      label: text('offline'),
      icon: 'wifi-off',
      value: offline,
      color: offline > 0 ? WIDGET_COLORS.DANGER : WIDGET_COLORS.SUCCESS,
    },
  );

  const rows = [...structures.map(homeRow), ...rooms.map((r) => roomRow(r, units))];
  if (rows.length > 0) {
    components.push({ type: 'status', items: rows.slice(0, MAX_STATUS_ITEMS) });
  }

  const [first] = structures;
  if (first) {
    const home = first.attributes?.home !== false;
    const auto = first.attributes?.mode === 'auto';
    components.push(
      {
        type: 'button',
        label: text(home ? 'setAway' : 'setHome'),
        icon: home ? 'log-out' : 'log-in',
        style: 'primary',
        action: { key: WIDGET_ACTIONS.TOGGLE_HOME, params: { structure: first.id, home: !home } },
      },
      {
        type: 'button',
        label: text(auto ? 'setManual' : 'setAuto'),
        icon: 'sliders',
        style: 'secondary',
        action: { key: WIDGET_ACTIONS.TOGGLE_AUTO, params: { structure: first.id, auto: !auto } },
      },
    );
  }
  components.push({
    type: 'button',
    label: text('refresh'),
    icon: 'refresh-cw',
    style: 'secondary',
    action: { key: WIDGET_ACTIONS.REFRESH },
  });

  return { ttl_seconds: 300, components };
}

export const WIDGETS = {
  [OVERVIEW_WIDGET]: {
    async get(gladys, { hub, units }) {
      logger.debug(`onWidgetGet <- ${OVERVIEW_WIDGET}`);
      return buildOverviewContent(gladys, hub, { units });
    },

    async action(gladys, { actionKey, params = {}, hub, sync }) {
      logger.info(`onWidgetAction <- ${OVERVIEW_WIDGET}.${actionKey}`);
      if (actionKey === WIDGET_ACTIONS.REFRESH) {
        const result = await sync.run();
        return text(result.ok ? 'refreshed' : 'refreshFailed');
      }
      if (actionKey === WIDGET_ACTIONS.TOGGLE_HOME || actionKey === WIDGET_ACTIONS.TOGGLE_AUTO) {
        const ids = gladys.externalIds(structure.kind, params.structure);
        const featureKey =
          actionKey === WIDGET_ACTIONS.TOGGLE_HOME
            ? STRUCTURE_FEATURES.HOME
            : STRUCTURE_FEATURES.AUTO_MODE;
        const on = actionKey === WIDGET_ACTIONS.TOGGLE_HOME ? params.home : params.auto;
        await applyCommand(gladys, hub, {
          deviceExternalId: ids.device,
          featureExternalId: ids.feature(featureKey),
          value: on ? 1 : 0,
        });
        return text('done');
      }
      // Throwing acks the action as failed: the message reaches the user.
      throw new Error(`Unknown widget action: ${actionKey}`);
    },
  },
};

/** Ask the core to re-pull every widget now (rate-limited core-side). */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
