# Flair

Pilotez vos bouches connectées [Flair](https://flair.co) (Smart Vents) depuis
Gladys, suivez la température de chaque pièce et passez votre maison de
Présent à Absent.

## Ce que vous obtenez

Une fois configurée, l'onglet **Découverte** liste un appareil par élément
Flair :

| Élément Flair | Dans Gladys                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| Maison        | Interrupteur **Présent** (éteint = Absent), **Mode auto** (éteint = Manuel) |
| Pièce         | **Consigne** (thermostat), **Température**, **Humidité**, **Active**        |
| Smart Vent    | **Ouverture** (0 % fermée à 100 % ouverte) et les boutons ouvrir / fermer   |
| Puck          | **Température**, **Humidité**                                               |

Chaque appareil affiche un badge **cloud** : Flair ne se pilote que par son
cloud. Le badge passe à **injoignable** quand Flair ne répond pas, ou quand
une bouche ou un puck ne donne plus de nouvelles (pile vide, hors de portée).

## Avant de commencer : obtenir vos identifiants d'API

Flair ouvre son API sur demande : écrivez au support Flair (depuis le site
ou l'application Flair) et demandez des **identifiants d'API** pour votre
compte. Vous recevez un **identifiant client** (client ID) et un **secret
client** (client secret).

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Collez l'**Identifiant client** et le **Secret client**.
3. Modifiez si besoin l'**Intervalle de rafraîchissement** : l'intégration
   lit votre compte Flair toutes les 2 minutes par défaut (une minute
   minimum).
4. Enregistrez, puis cliquez sur **Tester la connexion** : la réponse liste
   les maisons, pièces, bouches et pucks trouvés.
5. Ouvrez l'onglet **Découverte** et ajoutez les appareils voulus.

## Bon à savoir

- En mode **Auto**, Flair ouvre et ferme lui-même les bouches pour atteindre
  la consigne de chaque pièce. Une ouverture réglée depuis Gladys tient
  jusqu'à la prochaine décision de Flair. Pour garder les bouches là où vous
  les mettez, passez la maison en **Manuel** (interrupteur **Mode auto**).
- Une pièce **inactive** est mise de côté par Flair : ses bouches restent
  fermées.
- Un changement fait dans l'application Flair arrive dans Gladys au prochain
  rafraîchissement.

## Scènes

L'intégration ajoute ses propres cartes à l'éditeur de scènes, dans la
catégorie **Intégrations**.

Déclencheurs :

- **Flair présent ou absent a changé** — une maison est passée de Présent à
  Absent ou l'inverse (application Flair, géorepérage ou Gladys… sauf un
  changement fait par la même scène). Choisissez éventuellement la maison et
  le nouveau mode. Les actions suivantes peuvent lire
  `{{triggerEvent.data.mode}}` (`home` ou `away`) et
  `{{triggerEvent.data.home_name}}`.
- **Appareil Flair en ligne ou hors ligne** — une bouche ou un puck a cessé
  de répondre, ou est revenu. Choisissez éventuellement l'appareil et l'état.
  Variables : `{{triggerEvent.data.status}}` (`offline` ou `online`) et
  `{{triggerEvent.data.device_name}}`.

Actions :

- **Régler l'ouverture d'une bouche Flair** — de 0 à 100 %. Renvoie
  l'ouverture et si la maison est en mode Auto (Flair peut alors redéplacer
  la bouche).
- **Régler la consigne d'une pièce Flair** — de 10 à 32 °C. Renvoie la
  consigne.
- **Passer une maison Flair en Présent ou Absent** — renvoie si la maison est
  en Présent.
- **Passer une maison Flair en Auto ou Manuel** — renvoie si le mode Auto est
  actif.

## Tableau de bord

Ajoutez le widget **Vue d'ensemble Flair** à un tableau de bord. Il affiche
la température moyenne des pièces, le nombre de bouches ouvertes, les
appareils hors ligne, puis chaque maison (Présent / Absent, Auto / Manuel) et
chaque pièce (température → consigne, en vert si proche, orange ou rouge si
éloignée). Ses boutons basculent la première maison entre Présent et Absent,
entre Auto et Manuel, et rafraîchissent les données tout de suite.

## Dépannage

- **« Flair a refusé les identifiants de l'API »** — vérifiez l'identifiant
  et le secret client, sans espace autour. Contactez le support Flair si le
  refus persiste.
- **« Le cloud Flair ne répond pas »** — Flair ou votre connexion Internet
  est en panne. L'intégration réessaie à chaque rafraîchissement.
- **Un appareil reste injoignable** — vérifiez sa pile et sa distance au pont
  (bridge) Flair dans l'application Flair.
- Plus de détails dans les logs de l'intégration (interface Gladys, ou
  `docker logs` sur l'hôte), avec `LOG_LEVEL=debug`.
