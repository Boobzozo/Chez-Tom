// Configuration PM2 (voir DEPLOIEMENT.md) : `pm2 start ecosystem.config.cjs`.
// Fixe le dossier de travail et le fuseau horaire, quel que soit l'endroit d'où PM2 est lancé.
module.exports = {
  apps: [
    {
      name: "tom-barber",
      script: "npm",
      args: "start",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        TZ: "Europe/Paris",
      },
      time: true,               // horodatage des logs
      max_memory_restart: "300M",
    },
  ],
};
