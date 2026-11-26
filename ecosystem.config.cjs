// VPS without Docker:  npm i -g pm2 && pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: 'adez-nexus',
      script: 'index.js',
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      max_memory_restart: '700M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
