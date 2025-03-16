#!/bin/bash

set -e 

source utils.sh

print_message "info" "Setting up Telex Server Monitoring application"


ARGS=("$@")
ALLOWED_ARGS=("--channel-id" "ci")


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
        --channel-id | ci)
            CHANNEL_ID="${ARGS[$flag_arg_index]}"
            ;;
    esac
    
done



# start up package

chmod +x package-dev.sh setup-integration.sh utils.sh

bash setup-integration.sh
bash package-dev.sh --channel-id $CHANNEL_ID
