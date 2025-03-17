#!/bin/bash

set -e


BASE_PATH=$(echo "$PWD" | sed 's:/shell-scripts::')

# Function to print colored output
print_message() {
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    RED='\033[0;31m'
    NC='\033[0m' # No Color
    
    case $1 in
        "info")
            echo -e "${BLUE}INFO: ${NC}$2"
            ;;
        "success")
            echo -e "${GREEN}SUCCESS: ${NC}$2"
            ;;
        "error")
            echo -e "${RED}ERROR: ${NC}$2"
            ;;
    esac
}


# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# check if passed arg is correct
check_allowed_args() {

    local found_index=-1
    local -n args=$2
    for i in "${!args[@]}"; do
        if [[ "${args[i]}" == $1 ]]; then
            found_index=$i
            break
        fi
    done

   echo $found_index
}


run_check_allowed_args() {
    local -n args=$1
    local -n allow_args=$2

    for i in "${!args[@]}"; do
        if [[ "${args[i]}" == --* || "${args[i]}" == -*  ]]; then
            local check=$(check_allowed_args "${args[i]}" allow_args)
             if [ $check -lt 0 ]; then
                print_message "error" "Unknown arg passed ${args[i]} ${args[ i + 1 ]}"
                exit 1
            fi
        fi
    done
}


validate() {
    local -n val_args=$4
    if [ -z "${val_args[$2]}" ]; then
        print_message "error" "invalid arg passed $1 <$3>"
        exit 1
    fi
}


validate_port_num() {
    if [ "$1" -le 30 ]; then
        print_message "error" "Port number must be greater than 30. $2"
        exit 1;
    fi
}
