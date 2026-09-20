# Tom Barber — Barbier & Coiffeur

Site vitrine avec **réservation en ligne** et **espace gérant** pour un salon de coiffure/barbier.

- **Front** : React 19 + TypeScript + Tailwind CSS v4 (Vite), polices auto-hébergées
- **Back** : Express + SQLite (`better-sqlite3`) + Socket.io — un seul serveur, un seul port
- **Automatisations** (facultatives) : e-mail de confirmation via Resend, webhooks n8n
  (Google Agenda, Google Sheets, notification Telegram du gérant)

---

## Démarrage rapide

```bash
npm install
npm run dev          # → http://localhost:3000
```

C'est tout : le serveur Express sert aussi le front (via Vite en dev, via `dist/` en production).
La base SQLite (`chez-tom.db`) et le dossier des photos (`uploads/`) se créent automatiquement
au premier lancement, avec des prestations et horaires par défaut.

**Espace gérant** : accessible sur **`/admin`** (ex. `http://localhost:3000/admin`
en local, `https://votre-domaine.fr/admin` en ligne — aucun lien visible sur le site public,
et la page est exclue des moteurs de recherche via `robots.txt`).
Mot de passe initial : `admin123`. **À la première connexion, le site impose d'en choisir
un nouveau** (8 caractères minimum, différent de celui par défaut) avant d'accéder au tableau de bord.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Développement (HMR) sur le port 3000 |
| `npm run build` | Build de production dans `dist/` |
| `npm start` | Production : sert `dist/` + API sur `PORT` (défaut 3000) |
| `npm test` | Tests de l'API (serveur lancé sur une base temporaire, sans webhook ni e-mail) |
| `npm run lint` | Vérification TypeScript |

## Configuration (`.env`)

Copier `.env.example` en `.env`. Tout est **facultatif** pour tester en local :

| Variable | Rôle |
|---|---|
| `PORT` | Port du serveur (3000 par défaut) |
| `TZ` | Fuseau horaire du planning (`Europe/Paris` par défaut) |
| `DB_PATH` | Emplacement de la base SQLite (défaut : `chez-tom.db` à côté de `server.ts`) |
| `UPLOADS_DIR` | Dossier des photos de la galerie (défaut : `uploads/` à côté de `server.ts`) |
| `APP_URL` | URL publique du site (nécessaire pour lier Google Calendar) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google Calendar |
| `GOOGLE_CALENDAR_ID` | Agenda Google cible (sinon, choisi dans l'espace gérant) |
| `RESEND_API_KEY` | E-mail de confirmation au client via Resend |
| `MAIL_FROM` | Expéditeur des e-mails — **doit être un domaine vérifié chez Resend** en production (voir plus bas) |
| `N8N_BOOKING_WEBHOOK_URL` | Webhook n8n appelé après chaque réservation (agenda, tableur, e-mail) |
| `N8N_TELEGRAM_WEBHOOK_URL` | Webhook n8n de notification Telegram du gérant |

Les webhooks non renseignés sont simplement désactivés ; le log de démarrage récapitule
ce qui est actif.

## Ce que gère l'espace gérant

- **Calendrier** des rendez-vous (FullCalendar), ajout d'indisponibilités
- **Prestations** : nom, prix, durée, description, catégorie — tout est modifiable sans toucher au code
- **Horaires d'ouverture** par jour, avec pause déjeuner
- **Horizon de réservation** : jusqu'à combien de semaines à l'avance un client peut réserver (1 à 12, 4 par défaut)
- **Galerie** (photos réduites automatiquement à 1600 px avant l'envoi) et section « À propos » activables/désactivables
- **Notifications** temps réel à chaque réservation
- **Mot de passe** modifiable ; sessions authentifiées par token (24 h)

## Réservation : comment ça circule

**Le planning fonctionne à 100 % en local** — aucun compte Google ni n8n requis.
La base SQLite est la source de vérité : le serveur calcule lui-même les créneaux libres
(horaires d'ouverture − pause − réservations confirmées − indisponibilités), et **revérifie
le créneau au moment de la réservation** avec exactement le même calcul. Un appel direct à l'API
ne peut donc pas réserver hors horaires, sur un créneau bloqué, déjà pris, dans le passé ou
au-delà de l'horizon. La prestation est retrouvée côté serveur par son identifiant : durée et
prix font foi, la fin du rendez-vous est calculée par le serveur.

**Synchro Google dans les deux sens (si un agenda est lié).** En plus du local,
le serveur lit l'agenda Google du gérant : **tout événement** qu'il y ajoute
directement (depuis son téléphone, par exemple une sortie perso) **bloque le créneau
côté client**. Exceptions : les événements marqués « Disponible » (transparency) ne
bloquent pas, et un événement « journée entière » bloque toute la journée.
Si Google est momentanément injoignable, le calcul retombe sur le local (jamais bloquant).

```
Visiteur → tunnel de réservation (4 étapes, src/booking/)
  étape créneau  → GET /api/availability (local + agenda Google du gérant)
  confirmation   → POST /api/bookings (revalidé + limité côté serveur, transaction SQLite)
       ├─ enregistrement SQLite (source de vérité), avec le consentement au rappel
       ├─ e-mail Resend (si RESEND_API_KEY + MAIL_FROM)
       ├─ webhook N8N_TELEGRAM_WEBHOOK_URL (facultatif) → alerte Telegram au gérant
       └─ webhook N8N_BOOKING_WEBHOOK_URL (facultatif) → Google Agenda + Google Sheets + e-mail
```

Le tunnel n'annonce un e-mail de confirmation au client **que si** le serveur en envoie
réellement (Resend ou webhook n8n configuré). La case « J'accepte que le salon me recontacte »
est enregistrée avec la réservation (`sms_opt_in`) et transmise à n8n ; **aucun rappel
automatique n'est envoyé aujourd'hui** — c'est une évolution possible (SMS via Twilio…).

Les indisponibilités posées dans l'espace gérant bloquent immédiatement les créneaux ;
si un compte Google est lié, elles sont aussi recopiées dans l'agenda (miroir, jamais bloquant).

**Pour un gérant sans compte Google** : tout fonctionne ;
adaptez seulement le workflow n8n (nœud Gmail → SMTP) si vous voulez l'e-mail de confirmation par n8n.

## E-mail de confirmation (Resend)

`onboarding@resend.dev` (valeur par défaut de `MAIL_FROM`) est le **bac à sable** de Resend :
il ne livre qu'à l'adresse du compte Resend. Le serveur l'affiche en avertissement au démarrage.
Pour que les clients reçoivent l'e-mail :

1. Ajouter et vérifier votre domaine sur https://resend.com/domains (enregistrements DNS DKIM/SPF).
2. Mettre `MAIL_FROM="Tom Barber <rendez-vous@votre-domaine.fr>"` dans `.env`.

## Avant la mise en ligne — checklist

1. **Domaine** : remplacer `https://tom-barber.fr` par votre domaine réel dans
   `index.html` (canonical, Open Graph, JSON-LD), `public/robots.txt`, `public/sitemap.xml`.
2. **Coordonnées du salon** : adresse/téléphone dans `index.html` (JSON-LD),
   `src/App.tsx` (pied de page), `src/booking/Booking.tsx` (`SALON_ADDRESS`) et `server.ts` (e-mail).
   Le numéro `01 23 45 67 89` est un **exemple**, pas un vrai numéro.
3. **Images** : le hero, la section Services et l'image de partage (`og:image`) utilisent des photos
   Unsplash de démonstration — remplacez-les par les photos du salon (la galerie, elle, se gère
   depuis l'espace gérant).
4. **Textes** : la citation, « L'histoire de Tom Barber » et les liens réseaux sociaux (`#`) du pied
   de page sont des placeholders.
5. **Mentions légales / politique de confidentialité** : à rédiger selon votre société
   (obligatoire en France ; le site collecte nom, e-mail et téléphone).
6. **E-mail** : domaine vérifié chez Resend et `MAIL_FROM` (voir ci-dessus), ou e-mail via n8n.
7. **n8n** : renseigner les deux URL de webhook dans `.env` et **activer** les workflows
   (celui de Telegram est livré inactif).
8. Voir `DEPLOIEMENT.md` pour l'hébergement pas à pas.

## Sécurité (déjà en place)

- Mot de passe gérant **hashé** (scrypt) en base, jamais renvoyé par l'API ; changement imposé
  à la première connexion
- Endpoints sensibles (données clients, réglages, galerie, Google) protégés par **token Bearer** ;
  les réglages publics sont limités à une liste blanche
- Socket temps réel réservé aux admins authentifiés
- **Rate limiting** par IP réelle (derrière un proxy : `trust proxy`) sur la réservation et le login
- Réservation **revalidée côté serveur** (horaires, indisponibilités, doublons, horizon, prestation)
- E-mail de confirmation : valeurs client **échappées** (pas d'injection HTML)
- OAuth Google protégé par un paramètre `state` à usage unique
- En-têtes de sécurité (nosniff, X-Frame-Options, Referrer-Policy, HSTS en HTTPS)
- Photos de la galerie validées (type, taille) et stockées sous un nom non devinable

## Tests

```bash
npm test
```

Lance le serveur en mode test (`NODE_ENV=test` : API seule, base et dossier photos temporaires,
aucun webhook, aucun e-mail, pas de rate limiting) et vérifie les règles de réservation, les
indisponibilités, les droits d'accès, le mot de passe, la galerie et le callback OAuth.
