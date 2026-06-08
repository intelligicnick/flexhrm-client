/** PM2 process manager config — run: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "flexhrm",
      script: "dist/server.cjs",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "./logs/flexhrm-error.log",
      out_file: "./logs/flexhrm-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
