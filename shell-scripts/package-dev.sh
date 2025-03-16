#!/bin/bash

set -eu # terminate on error and treat unset variable as error

source utils.sh

EXITING="Exiting setup..."

print_message "info" "Script requires you already have node installed"

# check command line arg
if [[ $# -lt 2 ]]; then
    print_message "error" "Channel ID is required. Usage: $0 --channel-id <channel-id>. $EXITING"
    exit 1

else
    case $1 in
        --channel-id | -ci)
            CHANNEL_ID="$2"
            ;;
        *)
            echo "Error - unknown argument: $1"
            exit 1;;
    esac
fi


if ! command_exists node; then
    print_message "error" "node not found. Please install nodejs to run this script. $EXITING"
    exit 1
else
    print_message "info" "NodeJS is available.."
fi

if ! command_exists npm; then
    print_message "error" "npm not found. Please install npm. $EXITING"
    exit 1
fi

# install pm2 if not found
if ! command_exists pm2; then
    print_message "info" "Installing pm2 globally..."
    sudo npm install -g pm2
    print_message "success" "pm2 installed successfully"
fi



print_message "info" "Compiling package..."
# compile
tsc -p $BASE_PATH/package/tsconfig.json 

# add pm2 ecosystem file if it does not exist
print_message "info" "Creating pm2 config file..."
pm2_ecosystem_path="$BASE_PATH/package/ecosystem.config.cjs"
if [ ! -f "$pm2_ecosystem_path" ]; then
cat << EOF > $pm2_ecosystem_path
module.exports = {
    apps: [
        {
            name: "telex-server-monitor-dev",
            script: "$BASE_PATH/package/dist/cli/index.js",
            args: "start",
            exp_backoff_restart_delay: 100,
            max_memory_restart: "200M",
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            merge_logs: true,
            instances: 1,
            autorestart: true,
            watch: true,
            env: {
                NODE_ENV: "development",
            },
            restart_delay: 4000,
            max_restarts: 10,
            min_uptime: "30s",
        },
    ],
};
EOF
fi


CLI_PATH="$BASE_PATH/package/dist/cli/index.js"

print_message "info" "Setting up Telex Server Monitor..."
node "$CLI_PATH" setup --channel-id "$CHANNEL_ID"


# Stop any existing PM2 process
pm2 delete telex-server-monitor-dev 2>/dev/null || true

# Start the application with PM2
print_message "info" "Starting Telex Server Monitor with PM2..."
pm2 start $BASE_PATH/package/ecosystem.config.cjs # in the root folder as the script

print_message "success" "Telex Server Monitor is running..."
print_message "info" "You can check the status using: pm2 status telex-server-monitor-dev"
print_message "info" "View logs using: pm2 logs telex-server-monitor-dev"
print_message "info" "To manually restart the service: pm2 restart telex-server-monitor-dev" 
print_message "info" "To manually stop the service: pm2 stop telex-server-monitor-dev" 