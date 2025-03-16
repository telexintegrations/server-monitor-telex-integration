#!/bin/bash

set -e # terminate immediately after an error

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

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --channel-id)
            CHANNEL_ID="$2"
            shift
            shift
            ;;
        *)
            print_message "error" "Unknown argument: $1"
            exit 1
            ;;
    esac
done

# Check if channel ID is provided
if [ -z "$CHANNEL_ID" ]; then
    print_message "error" "Channel ID is required. Usage: $0 --channel-id <channel-id>"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
else
    OS=$(uname -s)
fi

print_message "info" "Detected OS: $OS"

# Install Node.js if not present
if ! command_exists node; then
    print_message "info" "Node.js not found. Installing Node.js..."
    
    case $OS in
        "Ubuntu" | "Debian GNU/Linux")
            # Install Node.js using NodeSource
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        "CentOS Linux" | "Red Hat Enterprise Linux")
            # Install Node.js using NodeSource
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            sudo yum install -y nodejs
            ;;
        "Darwin")
            # Install Node.js using Homebrew
            if ! command_exists brew; then
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install node@18
            ;;
        *)
            print_message "error" "Unsupported operating system: $OS"
            exit 1
            ;;
    esac
    
    print_message "success" "Node.js installed successfully"
fi

# Verify Node.js installation
NODE_VERSION=$(node --version)
print_message "info" "Node.js version: $NODE_VERSION"

# Install npm if not present (should be installed with Node.js, but just in case)
if ! command_exists npm; then
    print_message "error" "npm not found. Please install npm manually."
    exit 1
fi

# Install PM2 globally if not present
if ! command_exists pm2; then
    print_message "info" "Installing PM2 globally..."
    sudo npm install -g pm2
    print_message "success" "PM2 installed successfully"
fi

# Create installation directory
INSTALL_DIR="/opt/telex-server-monitor"
sudo mkdir -p $INSTALL_DIR

# Uninstall the Telex Server Monitor package if it was previously installed
sudo npm uninstall -g telex-server-monitor-sdk

# Install the Telex Server Monitor package
print_message "info" "Installing Telex Server Monitor..."
sudo npm install -g telex-server-monitor-sdk

# Find npm global directory
NPM_GLOBAL_DIR=$(npm root -g)
print_message "info" "NPM global directory: $NPM_GLOBAL_DIR"

# Find node executable
NODE_PATH=$(which node)
print_message "info" "Node executable path: $NODE_PATH"

# Find the CLI entry point
CLI_PATH="$NPM_GLOBAL_DIR/telex-server-monitor-sdk/dist/cli/index.js"
if [ ! -f "$CLI_PATH" ]; then
    print_message "error" "Could not find CLI entry point at $CLI_PATH"
    exit 1
fi

print_message "info" "Found CLI entry point at: $CLI_PATH"

# Ensure executable permissions
sudo chmod +x "$CLI_PATH"

# Run setup command to initialize configuration
print_message "info" "Setting up Telex Server Monitor..."
"$NODE_PATH" "$CLI_PATH" setup --channel-id "$CHANNEL_ID"

# Create PM2 ecosystem file
cat << EOF | sudo tee $INSTALL_DIR/ecosystem.config.js
module.exports = {
  apps: [{
    name: 'telex-server-monitor',
    script: '$CLI_PATH',
    args: 'start',
    exp_backoff_restart_delay: 100,
    max_memory_restart: '200M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production'
    },
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '30s'
  }]
}
EOF

# Stop any existing PM2 process
pm2 delete telex-server-monitor 2>/dev/null || true

# Start the application with PM2
print_message "info" "Starting Telex Server Monitor with PM2..."
pm2 start $INSTALL_DIR/ecosystem.config.js

# Set up PM2 to start on system boot
print_message "info" "Setting up PM2 startup script..."

# Generate startup script based on OS
case $OS in
    "Ubuntu" | "Debian GNU/Linux")
        # For Ubuntu/Debian systems
        pm2 startup systemd -u $USER --hp $HOME
        ;;
    "CentOS Linux" | "Red Hat Enterprise Linux")
        # For CentOS/RHEL systems
        pm2 startup | tail -n 1 | sudo bash
        ;;
    "Amazon Linux")
        # For Amazon Linux
        pm2 startup | tail -n 1 | sudo bash
        ;;
    *)
        # Default startup command
        pm2 startup | tail -n 1 | sudo bash
        ;;
esac

# Save the current PM2 process list
pm2 save

# Verify PM2 startup configuration
if systemctl list-unit-files | grep -q "pm2-$USER.service"; then
    print_message "success" "PM2 startup service installed successfully"
else
    print_message "warn" "PM2 startup service not found. Manual verification required"
fi

# Create a startup verification script
cat << EOF | sudo tee $INSTALL_DIR/verify-startup.sh
#!/bin/bash
# Wait for network to be up
sleep 30
# Check if PM2 is running
if ! pm2 list | grep -q "telex-server-monitor"; then
    # If not running, start PM2 and the monitor
    pm2 resurrect
    if ! pm2 list | grep -q "telex-server-monitor"; then
        pm2 start $INSTALL_DIR/ecosystem.config.js
    fi
fi
EOF

# Make the verification script executable
sudo chmod +x $INSTALL_DIR/verify-startup.sh

# Add the verification script to crontab to run on reboot
(crontab -l 2>/dev/null; echo "@reboot $INSTALL_DIR/verify-startup.sh") | crontab -

# Create log directories
sudo mkdir -p /var/log/telex-server-monitor

print_message "success" "Telex Server Monitor installation completed successfully!"
print_message "info" "The service will automatically start on system reboot"
print_message "info" "You can check the status using: pm2 status telex-server-monitor"
print_message "info" "View logs using: pm2 logs telex-server-monitor"
print_message "info" "To manually restart the service: pm2 restart telex-server-monitor" 
print_message "info" "To manually stop the service: pm2 stop telex-server-monitor" 