/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: "fishing-pos",
      script: "node_modules/.bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      cwd: "/var/www/fishing-pos",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      error_file: "/var/log/fishing-pos/pm2-error.log",
      out_file: "/var/log/fishing-pos/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
