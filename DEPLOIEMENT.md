# Déploiement — Chez Tom

Guide pas à pas pour mettre le site en ligne sur un **VPS** (Hostinger, OVH, Scaleway…).
Le site est un unique serveur Node : pas de base de données externe à installer.

## Prérequis

- Un VPS avec Ubuntu 22.04+ et un accès SSH
- Un nom de domaine pointé sur l'IP du VPS (enregistrement A)
- Node.js 20+ sur le VPS

```bash
# Sur le VPS — installer Node 20 (si absent)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 1. Récupérer le projet

```bash
cd /var/www
git clone https://github.com/Boobzozo/Chez-Tom.git chez-tom
cd chez-tom
npm install
```

## 2. Configurer

```bash
cp .env.example .env
nano .env
```

```ini
PORT=3000
APP_URL="https://votre-domaine.fr"
GOOGLE_CLIENT_ID="…"        # si intégration Google Calendar
GOOGLE_CLIENT_SECRET="…"
RESEND_API_KEY=""           # vide si l'email part de n8n
```

Puis remplacer `https://chez-tom.fr` par votre domaine dans
`index.html`, `public/robots.txt` et `public/sitemap.xml` (checklist complète dans le README).

## 3. Build + lancement avec PM2

PM2 garde le site en vie et le relance au reboot :

```bash
sudo npm install -g pm2
npm run build
pm2 start npm --name chez-tom -- start
pm2 save
pm2 startup          # suivre l'instruction affichée
```

Vérifier : `curl http://localhost:3000/api/health` → `{"status":"ok", …}`.

## 4. Nginx + HTTPS

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo nano /etc/nginx/sites-available/chez-tom
```

```nginx
server {
    listen 80;
    server_name votre-domaine.fr www.votre-domaine.fr;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        # WebSocket (notifications temps réel de l'espace gérant)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
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
n8n ne sert plus qu'aux à-côtés après réservation :

| Webhook | Rôle | Appelé depuis |
|---|---|---|
| `reservation-chez-tom` | Google Agenda + Google Sheets + email de confirmation | `server.ts` |

Si vous l'utilisez : recréez le workflow sur votre instance, **activez**-le, et remplacez
l'URL dans `server.ts`. Le payload transmet notamment `customer_name`, `customer_email`,
`customer_phone`, `service_type`, `duration`, `price`, `start_time`, `end_time`.
Sans compte Google, remplacez le nœud Gmail par un nœud SMTP (email) et supprimez
les nœuds Google Agenda/Sheets — ou n'utilisez pas n8n du tout.

## 6. Après la mise en ligne

1. Se connecter à l'espace gérant sur `https://votre-domaine.fr/admin` et **changer le mot de passe** (`admin123`).
2. Renseigner prestations, horaires et galerie depuis l'espace gérant.
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
4. Déclarer le site sur [Google Search Console](https://search.google.com/search-console)
   et soumettre `https://votre-domaine.fr/sitemap.xml`.
5. Créer la fiche [Google Business Profile](https://business.google.com) du salon
   (indispensable pour le référencement local) avec les mêmes nom/adresse/téléphone que le site.

## Sauvegardes

Toutes les données vivent dans **un seul fichier** : `chez-tom.db`.

```bash
# Sauvegarde quotidienne à 3h00 (crontab -e)
0 3 * * * cp /var/www/chez-tom/chez-tom.db /var/backups/chez-tom-$(date +\%u).db
```

## Mise à jour du site

```bash
cd /var/www/chez-tom
git pull
npm install
npm run build
pm2 restart chez-tom
```
