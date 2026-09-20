# Déploiement — Tom Barber

Guide pas à pas pour mettre le site en ligne sur un **VPS** (Hostinger, OVH, Scaleway…).
Le site est un unique serveur Node : pas de base de données externe à installer.

## Prérequis

- Un VPS avec Ubuntu 22.04+ et un accès SSH
- Un nom de domaine pointé sur l'IP du VPS (enregistrement A)
- Node.js 20+ sur le VPS

```bash
# Sur le VPS — installer Node 20 (si absent) et sqlite3 (pour les sauvegardes)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs sqlite3
```

## 1. Récupérer le projet

```bash
cd /var/www
git clone https://github.com/Boobzozo/Chez-Tom.git chez-tom
cd chez-tom
npm ci
```

## 2. Configurer

```bash
cp .env.example .env
nano .env
```

```ini
PORT=3000
TZ=Europe/Paris
APP_URL="https://votre-domaine.fr"

# E-mail de confirmation (facultatif) — domaine vérifié chez Resend obligatoire
RESEND_API_KEY="re_…"
MAIL_FROM="Tom Barber <rendez-vous@votre-domaine.fr>"

# Google Calendar (facultatif)
GOOGLE_CLIENT_ID="…"
GOOGLE_CLIENT_SECRET="…"

# n8n (facultatif) — vides = désactivés
N8N_BOOKING_WEBHOOK_URL="https://votre-n8n/webhook/reservation-chez-tom"
N8N_TELEGRAM_WEBHOOK_URL="https://votre-n8n/webhook/notification-telegram"
```

Puis remplacer `https://tom-barber.fr` par votre domaine dans
`index.html`, `public/robots.txt` et `public/sitemap.xml` (checklist complète dans le README).

## 3. Build + lancement avec PM2

PM2 garde le site en vie et le relance au reboot. Le fichier `ecosystem.config.cjs` fixe le
dossier de travail et le fuseau horaire, quel que soit l'endroit d'où PM2 est lancé.

```bash
sudo npm install -g pm2
npm run build
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup          # suivre l'instruction affichée
```

Vérifier : `curl http://localhost:3000/api/health` → `{"status":"ok", …}`.
Le log de démarrage (`pm2 logs tom-barber`) récapitule la configuration active (base, photos,
fuseau, webhooks, e-mail) et avertit si `MAIL_FROM` est encore le bac à sable Resend.

## 4. Nginx + HTTPS

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/chez-tom
```

```nginx
server {
    listen 80;
    server_name votre-domaine.fr www.votre-domaine.fr;

    # Envoi des photos de la galerie (JSON ≈ 4 Mo max) — sinon erreur 413
    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        # WebSocket (notifications temps réel de l'espace gérant)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        # IP réelle du visiteur : indispensable au rate limiting (le serveur fait confiance
        # à ce proxy via `trust proxy`)
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/chez-tom /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d votre-domaine.fr -d www.votre-domaine.fr   # HTTPS automatique
```

## 5. n8n (facultatif — notifications & agenda)

Les créneaux sont calculés **par le site lui-même** (aucune dépendance externe).
n8n ne sert qu'aux à-côtés après réservation :

| Variable `.env` | Rôle |
|---|---|
| `N8N_BOOKING_WEBHOOK_URL` | Google Agenda + Google Sheets + e-mail de confirmation |
| `N8N_TELEGRAM_WEBHOOK_URL` | Message Telegram au gérant à chaque réservation |

Si vous les utilisez : recréez les workflows sur votre instance, **activez**-les, et renseignez
les URL dans `.env`. Le payload transmet notamment `booking_id`, `customer_name`, `customer_email`,
`customer_phone`, `service_id`, `service_type`, `duration`, `price`, `start_time`, `end_time`,
`sms_opt_in`, `formatted_date`, `formatted_time`.
Sans compte Google, remplacez le nœud Gmail par un nœud SMTP (e-mail) et supprimez
les nœuds Google Agenda/Sheets — ou n'utilisez pas n8n du tout.

## 6. Après la mise en ligne

1. Se connecter à l'espace gérant sur `https://votre-domaine.fr/admin` avec `admin123` :
   le site **impose de choisir un nouveau mot de passe** avant d'aller plus loin.
2. Renseigner prestations, horaires, horizon de réservation et galerie depuis l'espace gérant.
3. Lier Google Calendar (bouton dans Configuration) si souhaité — nécessite
   `APP_URL`, `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`, et l'URL de redirection
   `https://votre-domaine.fr/auth/google/callback` déclarée dans la console Google Cloud.
   - **Publier l'app OAuth « en production »** dans la console Google (écran de consentement) :
     en mode « test », Google invalide la liaison au bout de 7 jours. Une fois publiée,
     la liaison est permanente (le site rafraîchit le jeton tout seul).
   - **Synchro deux sens** : une fois lié, **tous les événements** de l'agenda choisi
     bloquent les réservations en ligne (le gérant peut donc bloquer un créneau simplement
     en l'ajoutant à son Google Agenda depuis son téléphone). Pour qu'un événement perso
     ne bloque PAS, le marquer « Disponible » dans Google Agenda. Astuce : utiliser un
     agenda Google dédié (sélectionnable dans Configuration) pour séparer perso et salon.
4. Envoyer une réservation de test depuis le site et vérifier l'e-mail reçu (Resend) et,
   le cas échéant, l'agenda, le tableur et Telegram (n8n).
5. Déclarer le site sur [Google Search Console](https://search.google.com/search-console)
   et soumettre `https://votre-domaine.fr/sitemap.xml`.
6. Créer la fiche [Google Business Profile](https://business.google.com) du salon
   (indispensable pour le référencement local) avec les mêmes nom/adresse/téléphone que le site.

## Sauvegardes

Deux choses à sauvegarder : la base **`chez-tom.db`** (réservations, réglages, jeton Google)
et le dossier **`uploads/`** (photos de la galerie).

Ne copiez pas la base avec `cp` pendant que le site tourne : le fichier peut être capturé
au milieu d'une écriture. Utilisez la commande `.backup` de SQLite, qui produit une copie cohérente.

```bash
# Sauvegarde quotidienne à 3h00, 7 jours glissants (crontab -e)
0 3 * * * sqlite3 /var/www/chez-tom/chez-tom.db ".backup '/var/backups/chez-tom-$(date +\%u).db'" && tar -czf /var/backups/chez-tom-uploads-$(date +\%u).tgz -C /var/www/chez-tom uploads
```

Restauration : arrêter le site (`pm2 stop tom-barber`), remettre le `.db` et le dossier
`uploads/` en place, relancer (`pm2 start tom-barber`).

## Mise à jour du site

```bash
cd /var/www/chez-tom
git pull
npm ci
npm run build
pm2 restart tom-barber
```

Les migrations de base (nouvelles colonnes, nouveaux réglages, photos déplacées en fichiers)
s'appliquent automatiquement au démarrage.
