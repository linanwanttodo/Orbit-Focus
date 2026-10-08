#!/usr/bin/env bash
# Provision a fresh Ubuntu host and start Orbit Focus behind Caddy.
# Idempotent: safe to re-run after `git pull`.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="${DOMAIN:-orbit-focus.us.ci}"
export DOMAIN

echo "=== Orbit Focus deployment ==="
echo "Domain:  ${DOMAIN}"
echo "Project: ${PROJECT_DIR}"

echo "1. Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

if ! command -v docker > /dev/null 2>&1; then
  echo "2. Installing Docker..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
  sudo usermod -aG docker "$USER"
  echo "   Added $USER to the docker group. Log out and back in for it to apply."
else
  echo "2. Docker already installed."
fi

# Compose v2 ships as a docker plugin; the standalone v1 binary is EOL.
if ! docker compose version > /dev/null 2>&1; then
  echo "ERROR: the Docker Compose v2 plugin is missing. Install docker-compose-plugin first." >&2
  exit 1
fi

if ! command -v caddy > /dev/null 2>&1; then
  echo "3. Installing Caddy..."
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
  sudo apt-get update && sudo apt-get install -y caddy
else
  echo "3. Caddy already installed."
fi

if [ ! -f "${PROJECT_DIR}/.env.production" ]; then
  echo "ERROR: ${PROJECT_DIR}/.env.production is missing." >&2
  echo "       Run: cp .env.production.example .env.production, then set JWT_SECRET." >&2
  exit 1
fi

cd "$PROJECT_DIR"

echo "4. Building the image..."
docker compose -f docker-compose.prod.yml build

echo "5. Starting the container..."
docker compose -f docker-compose.prod.yml up -d

echo "6. Installing the Caddyfile and restarting Caddy..."
# Caddy runs as a systemd service, so it never sees this shell's DOMAIN.
# Substitute the domain into the installed copy instead.
sed "s|{\$DOMAIN:orbit-focus.us.ci}|${DOMAIN}|" "${PROJECT_DIR}/Caddyfile" \
  | sudo tee /etc/caddy/Caddyfile > /dev/null
sudo chmod 0644 /etc/caddy/Caddyfile
sudo systemctl enable caddy
sudo systemctl restart caddy

echo
echo "=== Deployment complete ==="
echo "  https://${DOMAIN}"
echo
echo "Logs:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo "  sudo journalctl -u caddy -f"
