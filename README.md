# Chez Tom — Barbier & Coiffeur

Site vitrine avec **réservation en ligne** et **espace gérant** pour un salon de coiffure/barbier.

- **Front** : React 19 + TypeScript + Tailwind CSS v4 (Vite)
- **Back** : Express + SQLite (`better-sqlite3`) + Socket.io — un seul serveur, un seul port
- **Automatisations** : webhooks n8n (créneaux disponibles, confirmation, Google Agenda, Google Sheets)

---

## Démarrage rapide

```bash
npm install
npm run dev          # → http://localhost:3000
```

C'est tout : le serveur Express sert aussi le front (via Vite en dev, via `dist/` en production).
La base SQLite (`chez-tom.db`) se crée automatiquement au premier lancement, avec des
prestations et horaires par défaut.

**Espace gérant** : accessible sur **`/admin`** (ex. `http://localhost:3000/admin`
en local, `https://votre-domaine.fr/admin` en ligne — aucun lien visible sur le site public,
et la page est exclue des moteurs de recherche via `robots.txt`).
Mot de passe initial : `admin123` — **à changer immédiatement** depuis
Espace Gérant → Configuration → « Changer le mot de passe gérant ».

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Développement (HMR) sur le port 3000 |
| `npm run build` | Build de production dans `dist/` |
| `npm start` | Production : sert `dist/` + API sur `PORT` (défaut 3000) |
| `npm run lint` | Vérification TypeScript |

## Configuration (`.env`)

Copier `.env.example` en `.env`. Tout est **facultatif** pour tester en local :

| Variable | Rôle |
|---|---|
| `PORT` | Port du serveur (3000 par défaut) |
| `APP_URL` | URL publique du site (nécessaire pour lier Google Calendar) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google Calendar (facultatif) |
| `RESEND_API_KEY` | Email de confirmation via Resend (facultatif — l'email peut aussi être envoyé par n8n) |

## Ce que gère l'espace gérant

- **Calendrier** des rendez-vous (FullCalendar), ajout d'indisponibilités
- **Prestations** : nom, prix, durée, description, catégorie — tout est modifiable sans toucher au code
- **Horaires d'ouverture** par jour, avec pause déjeuner
- **Galerie** et section « À propos » activables/désactivables
- **Notifications** temps réel à chaque réservation
- **Mot de passe** modifiable ; sessions authentifiées par token (24 h)

## Réservation : comment ça circule

**Le planning fonctionne à 100 % en local** — aucun compte Google ni n8n requis.
La base SQLite est la source de vérité : le serveur calcule lui-même les créneaux libres
(horaires d'ouverture − réservations confirmées − indisponibilités).

```
Visiteur → tunnel de réservation (4 étapes, src/booking/)
  étape créneau  → GET /api/availability (calcul local, instantané)
  confirmation   → POST /api/bookings (validé + limité côté serveur)
       ├─ enregistrement SQLite (source de vérité)
       ├─ email Resend (si RESEND_API_KEY)
       ├─ webhook n8n « notification-telegram » (facultatif) → alerte Telegram au gérant 📲
       └─ webhook n8n « reservation-chez-tom » (facultatif) → Google Agenda + Google Sheets + email Gmail
```

Les indisponibilités posées dans l'espace gérant bloquent immédiatement les créneaux ;
si un compte Google est lié, elles sont aussi recopiées dans l'agenda (miroir, jamais bloquant).

L'URL du webhook n8n est dans `server.ts` — à remplacer par la vôtre, ou à ignorer
si vous n'utilisez pas n8n. **Pour un gérant sans compte Google** : tout fonctionne ;
adaptez seulement le workflow n8n (nœud Gmail → SMTP) si vous voulez l'email de confirmation par n8n.

## Avant la mise en ligne — checklist

1. **Domaine** : remplacer `https://chez-tom.fr` par votre domaine réel dans
   `index.html` (canonical, Open Graph, JSON-LD), `public/robots.txt`, `public/sitemap.xml`.
2. **Coordonnées du salon** : adresse/téléphone dans `index.html` (JSON-LD),
   `src/App.tsx` (pied de page), `src/booking/Booking.tsx` (`SALON_ADDRESS`) et `server.ts` (email).
3. **Mot de passe gérant** : changer `admin123` dès la première connexion.
4. **Images** : le site utilise des photos Unsplash/Picsum de démonstration — remplacez-les
   par les photos du salon (galerie gérable depuis l'espace gérant).
5. **Mentions légales / politique de confidentialité** : à rédiger selon votre société
   (obligatoire en France pour un site professionnel).
6. **n8n** : recréer ou adapter les deux workflows (voir section ci-dessus).
7. Voir `DEPLOIEMENT.md` pour l'hébergement pas à pas.

## Sécurité (déjà en place)

- Mot de passe gérant **hashé** (scrypt) en base, jamais renvoyé par l'API
- Endpoints sensibles (données clients, réglages, galerie, Google) protégés par **token Bearer**
- Socket temps réel réservé aux admins authentifiés
- Validation serveur + **rate limiting** sur la réservation et le login
