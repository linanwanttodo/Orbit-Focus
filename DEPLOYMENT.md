# Deployment Guide

Single-host deployment: Docker Compose runs the Express + SQLite container, Caddy terminates TLS.

Related docs: [docs/deployment.md](docs/deployment.md) (Cloudflare Workers + D1),
[docs/docker-deployment.md](docs/docker-deployment.md) (full Docker reference).

## 1. DNS

Add an `A` record pointing the domain at the server IP:

```text
Type: A
Name: orbit-focus.us.ci
Content: 158.101.10.158
Proxy: DISABLED
```

The proxy must stay disabled: Caddy issues its own Let's Encrypt certificate and
validates it over HTTP-01, which a Cloudflare-proxied record breaks.

## 2. Server setup

```bash
sudo apt update && sudo apt upgrade -y

# Docker Engine + Compose v2 plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"
newgrp docker

# Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

## 3. Configure

```bash
cp .env.production.example .env.production
openssl rand -hex 32   # paste into JWT_SECRET
```

`.env.production` is gitignored. Required keys:

| Key | Notes |
|---|---|
| `JWT_SECRET` | Required. The server refuses to start when `NODE_ENV=production` and this is unset. |
| `PUBLIC_ORIGIN` | Public HTTPS origin, e.g. `https://orbit-focus.us.ci`. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional. Blank disables the GitHub sign-in option. |

Copy the `Caddyfile` to `/etc/caddy/Caddyfile` and set your domain in it.

## 4. Start

```bash
docker compose -f docker-compose.prod.yml up -d --build
sudo systemctl enable caddy && sudo systemctl restart caddy
```

`./deploy.sh` performs the same steps.

## 5. Verify

```bash
curl -I https://orbit-focus.us.ci
curl -s https://orbit-focus.us.ci/api/health
docker compose -f docker-compose.prod.yml ps
```

## 6. Operate

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=200
docker compose -f docker-compose.prod.yml down
sudo journalctl -u caddy -f
```

Back up `./data/orbit-focus.db` before upgrading; see
[docs/docker-deployment.md](docs/docker-deployment.md#3-数据持久化和备份).
