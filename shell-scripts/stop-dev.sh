#!/bin/bash

source utils.sh

pm2 delete telex-integration-dev
pm2 delete telex-package-dev

cd ../package
node dist/cli/index.js stop

print_message "success" "Scripts stopped successfully"