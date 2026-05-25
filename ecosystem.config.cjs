/**
 * PM2 ecosystem config — used on the Hostinger server to manage the backend process.
 * Start:   npx pm2 start ecosystem.config.cjs
 * Restart: npx pm2 restart parking-api
 * Logs:    npx pm2 logs parking-api
 * Status:  npx pm2 list
 */
module.exports = {
  apps: [
    {
      name: 'parking-api',

      // Entry point — compiled TypeScript output
      script: './parking_space_backend/dist/server.js',

      // Number of instances (1 = single process; 'max' = one per CPU core)
      instances: 1,

      // Restart automatically if the process crashes
      autorestart: true,

      // Do NOT watch files (we restart manually after each deploy)
      watch: false,

      // Restart if memory exceeds 512 MB
      max_memory_restart: '512M',

      // Merge all PM2 log files into one stream
      merge_logs: true,

      // Production environment — .env on the server overrides everything else
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
