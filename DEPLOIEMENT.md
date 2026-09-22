# Déploiement — Tom Barber

Le site se déploie comme un **projet Docker autonome** : son conteneur, son volume,
son réseau, son `.env`. Il se place derrière un reverse proxy Traefik déjà présent
sur le serveur, sans jamais modifier la configuration des autres projets.

## Principe

```
                   Internet
                      │
             ports 80 / 443
                      │
                 ┌────▼─────┐
                 │ Traefik  │   lit les étiquettes Docker, gère les certificats
                 └────┬─────┘
          ┌───────────┼───────────┐
          │           │           │
     ┌────▼───┐  ┌────▼───┐  ┌────▼─────┐
     │  n8n   │  │chez-tom│  │  autre   │   un projet = un dossier,
     └────────┘  └────┬───┘  └──────────┘   un compose, un volume
                      │
              volume chez-tom-data
              (base SQLite + photos)
```

Traefik surveille le socket Docker : il découvre le conteneur du site dès son
démarrage et lui délivre un certificat. **Aucun redémarrage de Traefik, aucune
modification de son fichier de configuration.** Les autres projets du serveur ne
sont jamais touchés.

Deux valeurs seulement dépendent de la machine, toutes deux dans `.env` :
`APP_HOST` (le domaine) et `PROXY_NETWORK` (le réseau de Traefik).

## Prérequis

- Un VPS Linux avec Docker et Docker Compose v2
- Un Traefik déjà en service, avec un résolveur de certificats
- Le domaine pointé sur l'IP du serveur (enregistrement A)

Relever le nom du réseau de Traefik :

```bash
docker inspect $(docker ps --filter name=traefik -q) --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}'
```

## Installation

```bash
mkdir -p /srv/apps && cd /srv/apps
git clone https://github.com/Boobzozo/Chez-Tom.git chez-tom
cd chez-tom
cp .env.example .env
nano .env          # renseigner au minimum APP_HOST et PROXY_NETWORK
docker compose up -d --build
```

Le premier build prend plusieurs minutes sur un petit VPS (compilation du front).

Vérifier :

```bash
docker compose logs -f app
```

Le démarrage récapitule la configuration active (base, photos, fuseau, webhooks,
e-mail) et signale si `MAIL_FROM` est encore le bac à sable Resend. Le certificat
arrive dans la minute qui suit ; en cas de doute, consulter les logs de Traefik.

## Mise à jour

```bash
cd /srv/apps/chez-tom
git pull
docker compose up -d --build
```

Les migrations de base (nouvelles colonnes, nouveaux réglages, photos déplacées
en fichiers) s'appliquent automatiquement au démarrage. Le volume n'est pas touché.

## Sauvegardes

Tout l'état du site tient dans le volume `chez-tom-data` : la base
`chez-tom.db` (réservations, réglages, jeton Google) et le dossier `uploads/`
(photos de la galerie).

Ne copiez jamais la base pendant que le site tourne : le fichier peut être capturé
au milieu d'une écriture. La commande `.backup` de SQLite produit une copie
cohérente sans arrêter le service — c'est pourquoi `sqlite3` est présent dans
l'image.

```bash
# Sauvegarde quotidienne à 3h00, 7 jours glissants (crontab -e)
0 3 * * * cd /srv/apps/chez-tom && docker compose exec -T app sqlite3 /data/chez-tom.db ".backup '/data/sauvegarde.db'" && docker compose cp app:/data/sauvegarde.db /srv/backups/chez-tom-$(date +\%u).db && docker compose exec -T app tar -czf - -C /data uploads > /srv/backups/chez-tom-uploads-$(date +\%u).tgz
```

Restauration : arrêter le site (`docker compose stop`), remettre le `.db` et
`uploads/` dans le volume, relancer (`docker compose start`).

## Migration vers un nouveau VPS

L'application ne contient aucune adhérence au serveur : seuls le volume et deux
variables déménagent.

**1. Sur l'ancien serveur — figer et archiver les données**

```bash
cd /srv/apps/chez-tom && docker compose stop
docker run --rm -v chez-tom-data:/data -v /root:/sortie alpine tar -czf /sortie/chez-tom-data.tgz -C /data .
```

**2. Transférer**

```bash
scp /root/chez-tom-data.tgz root@NOUVELLE_IP:/root/
```

**3. Sur le nouveau serveur — restaurer puis démarrer**

```bash
docker volume create chez-tom-data
docker run --rm -v chez-tom-data:/data -v /root:/entree alpine tar -xzf /entree/chez-tom-data.tgz -C /data
```

Puis l'installation normale (ci-dessus), en ajustant `APP_HOST` et
`PROXY_NETWORK` dans `.env`. Le `docker compose up -d --build` retrouvera le
volume existant avec ses données.

**4. Ne pas oublier, hors serveur**

- L'enregistrement A du domaine vers la nouvelle IP (abaisser le TTL la veille)
- L'URL de redirection OAuth dans la console Google si `APP_HOST` change
- Les workflows n8n et les URL de webhooks dans `.env` si n8n déménage aussi

## Architecture cible

Sur le VPS actuel (template « Ubuntu with n8n » de Hostinger), Traefik et n8n
partagent un même projet Docker et un même réseau, `root_default`. Le site s'y
raccroche : c'est fonctionnel, mais tous les conteneurs de ce réseau peuvent se
joindre entre eux.

Sur le prochain serveur, monter plutôt ceci :

```
/srv/
├── infra/traefik/      compose de Traefik seul — ports 80/443
└── apps/
    ├── chez-tom/       compose + .env + volume chez-tom-data
    ├── n8n/            compose + .env + volume n8n_data
    └── …
```

Pour un cloisonnement réel, donner à **chaque application son propre réseau** et
rattacher Traefik à tous. Une application ne voit alors que Traefik, jamais ses
voisines. C'est le rôle de l'étiquette `traefik.docker.network`, déjà présente
dans le `docker-compose.yml` du site : il suffira de changer `PROXY_NETWORK`.

Séparer Traefik de n8n a un second mérite : mettre à jour ou redémarrer n8n
n'interrompt plus les autres sites.

## Après la mise en ligne

1. Se connecter à l'espace gérant sur `https://<APP_HOST>/admin` avec `admin123` :
   le site **impose de choisir un nouveau mot de passe** avant d'aller plus loin.
2. Renseigner prestations, horaires, horizon de réservation et galerie depuis
   l'espace gérant.
3. Lier Google Calendar (bouton dans Configuration) si souhaité — nécessite
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, et l'URL de redirection
   `https://<APP_HOST>/auth/google/callback` déclarée dans la console Google Cloud.
   - **Publier l'app OAuth « en production »** dans la console Google (écran de
     consentement) : en mode « test », Google invalide la liaison au bout de
     7 jours. Une fois publiée, elle est permanente (le site rafraîchit le jeton).
   - **Synchro deux sens** : une fois lié, **tous les événements** de l'agenda
     choisi bloquent les réservations en ligne — le gérant peut donc bloquer un
     créneau en l'ajoutant à son agenda depuis son téléphone. Pour qu'un événement
     perso ne bloque PAS, le marquer « Disponible ». Astuce : utiliser un agenda
     Google dédié (sélectionnable dans Configuration) pour séparer perso et salon.
4. Envoyer une réservation de test et vérifier l'e-mail reçu (Resend) et, le cas
   échéant, l'agenda, le tableur et Telegram (n8n).
5. Déclarer le site sur [Google Search Console](https://search.google.com/search-console)
   et soumettre `https://<APP_HOST>/sitemap.xml`.
6. Créer la fiche [Google Business Profile](https://business.google.com) du salon
   (indispensable au référencement local) avec les mêmes nom, adresse et téléphone
   que le site.

## n8n (facultatif — notifications & agenda)

Les créneaux sont calculés **par le site lui-même** : aucune dépendance externe.
n8n ne sert qu'aux à-côtés après réservation.

| Variable `.env` | Rôle |
|---|---|
| `N8N_BOOKING_WEBHOOK_URL` | Google Agenda + Google Sheets + e-mail de confirmation |
| `N8N_TELEGRAM_WEBHOOK_URL` | Message Telegram au gérant à chaque réservation |

Le payload transmet `booking_id`, `customer_name`, `customer_email`,
`customer_phone`, `service_id`, `service_type`, `duration`, `price`, `start_time`,
`end_time`, `sms_opt_in`, `formatted_date`, `formatted_time`.

Sans compte Google, remplacer le nœud Gmail par un nœud SMTP et supprimer les
nœuds Google Agenda/Sheets — ou ne pas utiliser n8n du tout.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| 404 de Traefik | `APP_HOST` ne correspond pas au nom demandé, ou le conteneur n'est pas sur `PROXY_NETWORK` |
| Certificat absent / avertissement | Le domaine ne pointe pas encore sur l'IP, ou `CERT_RESOLVER` ne correspond pas à celui de Traefik |
| `network ... not found` | `PROXY_NETWORK` est erroné — le relever avec `docker network ls` |
| Photos disparues au redémarrage | Le volume n'est pas monté : vérifier `docker compose config` |
| Toutes les réservations bloquées par le rate limiting | `trust proxy` mal appliqué : vérifier que Traefik transmet `X-Forwarded-For` |
