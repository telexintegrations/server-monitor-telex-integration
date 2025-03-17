#!/bin/bash

set -e

source utils.sh

print_message "info" "Setting up nginx reverse proxy..."

APP_HOST="127.0.0.1"
APP_PORT=3002 
SERVER_PORT=443

ARGS=("$@")
ALLOWED_ARGS=("--app-host" "-ah" "--app-port" "-ap" "--server-port" "-sp")


run_check_allowed_args ARGS ALLOWED_ARGS

for i in "${!ARGS[@]}"; do
    arg="${ARGS[i]}"
    flag_arg_index=$(( i + 1 ))
    
    case "$arg" in
        "--app-host" | "-ah")
            validate $arg $flag_arg_index "app-host" ARGS
            APP_HOST="${ARGS[$flag_arg_index]}"
            ;;
        "--app-port" | "-ap")
            validate $arg $flag_arg_index "app-port" ARGS
            validate_port_num "${ARGS[$flag_arg_index]}" "--app-port"
            APP_PORT="${ARGS[$flag_arg_index]}"
            ;;
        "--server-port" | "-sp")
            validate $arg $flag_arg_index "server-port" ARGS
            validate_port_num "${ARGS[$flag_arg_index]}" "--server-port"
            SERVER_PORT="${ARGS[$flag_arg_index]}"
            ;;
    esac
    
done

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
else
    OS=$(uname -s)
fi

# install nginx if not found
if ! command_exists nginx; then
    print_message "info" "Nginx not found. Installing nginx..."
    case $OS in
        "Ubuntu" | "Debian GNU/Linux" | "KDE neon")
            sudo apt install nginx -y
            ;;
        "CentOS Linux" | "Red Hat Enterprise Linux")
            sudo yum install nginx -y
            ;;
        "Darwin")
            # Install nginx using Homebrew
            if ! command_exists brew; then
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install nginx
            ;;
        *)
            print_message "error" "Unsupported operating system: $OS"
            exit 1
            ;;
    esac
    
    print_message "success" "nginx installed successfully"

fi


SERVER_NAME=$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}') # get local IP address

# create nginx folder
if [ ! -d "$BASE_PATH/nginx" ]; then
    mkdir $BASE_PATH/nginx
    sudo mkdir -p $BASE_PATH/nginx/ssl
    # generate key and cert
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout $BASE_PATH/nginx/ssl/key.pem -out $BASE_PATH/nginx/ssl/cert.pem -subj "/C=US/ST=State/L=City/O=Telex/OU=Server-Monitor/CN=$SERVER_NAME"
fi


# configure nginx to route https to local host 
cat << EOF > $BASE_PATH/nginx/nginx.conf
events {}


http {

    server {
        listen $SERVER_PORT ssl;
        server_name mydevenv.com;

        ssl_certificate ssl/cert.pem;
        ssl_certificate_key ssl/key.pem;

        location / {
            proxy_pass http://127.0.0.1:$APP_PORT;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }

    server {
        listen 80;
        server_name mydevenv.com;

        return 301 https://$host$request_uri;
    }

}

EOF


NGINX_FOLDER_PATH="$BASE_PATH/nginx/nginx.conf"

# stop nginx if started already
sudo nginx -c $NGINX_FOLDER_PATH -s stop || true

sudo nginx -c "$NGINX_FOLDER_PATH"

print_message "success" "nginx configured successfully"
print_message "info" "application is accessible on: https://$SERVER_NAME:$SERVER_PORT"
print_message "info" "To manually stop nginx, run sudo nginx -c $NGINX_FOLDER_PATH -s stop"