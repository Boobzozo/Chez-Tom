# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Étape 1 — build : toutes les dépendances, compilation du front par Vite.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build

WORKDIR /app

# better-sqlite3 fournit des binaires précompilés pour linux/amd64. Ces outils ne
# servent que de filet : ils permettent à npm de compiler le module lui-même si
# aucun binaire n'est disponible (autre architecture, version de Node inattendue).
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# En production le serveur ne charge jamais Vite : une fois le front compilé,
# les dépendances de développement ne servent plus à rien.
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
# Étape 2 — exécution : image minimale, sans outils de compilation.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

# `sqlite3` sert uniquement aux sauvegardes : sa commande `.backup` produit une
# copie cohérente de la base pendant que le site tourne, ce qu'un simple `cp` ne
# garantit pas. Quelques mégaoctets pour ne pas avoir à arrêter le site.
RUN apt-get update \
 && apt-get install -y --no-install-recommends sqlite3 \
 && rm -rf /var/lib/apt/lists/*

# Le serveur de production sert dist/ : ni src/ ni index.html ne sont nécessaires.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server.ts    ./server.ts
COPY --from=build /app/dist         ./dist

# Données persistantes : base SQLite et photos de la galerie. Un volume est monté
# sur /data. Le dossier est créé ici pour que le volume hérite du bon propriétaire
# lors de sa toute première création.
ENV DB_PATH=/data/chez-tom.db
ENV UPLOADS_DIR=/data/uploads
RUN mkdir -p /data/uploads && chown -R node:node /data

USER node
EXPOSE 3000

# Le serveur expose déjà /api/health (voir server.ts).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Binaire appelé directement (plutôt que `npm start`) : un intermédiaire de moins
# entre Docker et le process, donc un arrêt propre de SQLite au `docker stop`.
CMD ["./node_modules/.bin/tsx", "server.ts"]
