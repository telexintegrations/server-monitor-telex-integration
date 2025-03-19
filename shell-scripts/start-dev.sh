#!/bin/bash

set -e 

source utils.sh

print_message "info" "Setting up Telex Server Monitoring application"


ARGS=("$@")
ALLOWED_ARGS=("--channel-id" "-ci", "--dev", "-d" ) 


run_check_allowed_args ARGS ALLOWED_ARGS


check_channel_id() {
    local found_channel_id=-1
    for i in "${!ARGS[@]}"; do
        if [[ "${ARGS[i]}" == "--channel-id" || "${ARGS[i]}" == "ci" ]]; then
            found_channel_id=$i;
            break
        fi
    done
    
    if [ $found_channel_id -lt 0 ]; then
        print_message "error" "Channel ID is required. --channel-id <channel-id>."
        exit
    fi
}

check_channel_id


for i in "${!ARGS[@]}"; do
    arg="${ARGS[i]}"
    flag_arg_index=$(( i + 1 ))
    
    case "$arg" in
        --channel-id | -ci)
            if [ -z "${ARGS[$flag_arg_index]}" ]; then
                print_message "error" "Channel ID is required. Usage: $0 --channel-id <channel-id>"
                exit 1
            fi
            CHANNEL_ID="${ARGS[$flag_arg_index]}"
            ;;
        --dev | -d)
            DEVELOPMENT_MODE=true;
    esac
    
done



# Install PM2 globally if not present
if ! command_exists pm2; then
    print_message "info" "Installing PM2 globally..."
    npm install -g pm2
    print_message "success" "PM2 installed successfully"
fi


install_dependencies() {
    if [ -d "node_modules" ]; then
        print_message "info" "node_modules exists in $1 folder"
    else
        print_message "info" "installing $1 dependencies"
        npm install
    fi
}

# start up integration
mode () {

    local instance_name="telex-$3-dev"
    if pm2 describe "$instance_name" | grep -q "online"; then
        print_message "info" "$instance_name instance already running"
    else
        if [[ $3 == "package" ]]; then
            tsc
            node dist/cli/index.js setup --channel-id "$CHANNEL_ID"
        fi

        if [[ $DEVELOPMENT_MODE = true ]]; then
            pm2 start "npm run $1" -n "$instance_name" -i 1 --watch
        else
            pm2 start "npm run $2" -n "$instance_name" -i 1
        fi
    fi
}

run() {    
    case "$1" in
        integration)
            mode "dev" "start" "integration"
            ;;
        package)
            mode "dev start" "start start" "package"
    esac
}

cd ../integration
install_dependencies "integration"
run "integration"

cd ../package
install_dependencies "package"
run "package"

cd ../shell-scripts
chmod +x stop-dev.sh

print_message "success" "applications up and running\n"
print_message "info" "To stop running application run ${GREEN}bash stop-dev.sh"


