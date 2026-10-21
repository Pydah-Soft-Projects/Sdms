/**
 * PM2 config for SDMS production (AWS Lightsail)
 * App name: sdms-backend
 */
module.exports = {
  apps: [
    {
      name: 'sdms-backend',
      script: './server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '380M',
      node_args: '--max-old-space-size=384',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Kolkata'
      },
      time: true
    }
  ]
};

