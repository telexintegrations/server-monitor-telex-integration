#!/bin/bash

source utils.sh



print_message "info" "Creating pm2 config file..."

pm2_ecosystem_path="$BASE_PATH/integration/dev-ecosystem.config.cjs"

if [ ! -f "$pm2_ecosystem_path" ]; then
cat << EOF > $pm2_ecosystem_path
module.exports = {
  apps: [
    {
      name: "telex-server-monitor-integration",
      script: "npm run dev --prefix $BASE_PATH/integration",
      exp_backoff_restart_delay: 100,
      max_memory_restart: "1G",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};
EOF
fi

if ! command_exists tsx; then
    print_message "info" "installing tsx..."
    npm install -g tsx
fi

if ! command_exists pm2; then
    print_message "info" "Installing pm2 globally..."
    sudo npm install -g pm2
    print_message "success" "pm2 installed successfully"
fi

pm2 start $BASE_PATH/integration/dev-ecosystem.config.cjs