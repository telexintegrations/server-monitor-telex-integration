#!/bin/bash

source utils.sh

pm2 delete telex-integration-dev
pm2 delete telex-package-dev

print_message "success" "Scripts stopped successfully"