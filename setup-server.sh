#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Orbit Focus - self-hosted server guided setup
#
# Walks through: environment checks, dependency install, database
# choice (SQLite / PostgreSQL), JWT secret, GitHub OAuth, frontend
# build, writes server/.env and optionally starts the server.
#
# Usage:
#   bash setup-server.sh            interactive
#   bash setup-server.sh --yes      non-interactive, all defaults
#   Environment variables already set (DB_CLIENT, JWT_SECRET, ...)
#   take precedence over prompts.
#
# Compatible with macOS and Linux (bash + coreutils).
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="server/.env"
NONINTERACTIVE=0
if [ "${1:-}" = "--yes" ]; then
  NONINTERACTIVE=1
fi
if [ ! -t 0 ]; then
  NONINTERACTIVE=1
fi

say() { printf '%s\n' "$*"; }

# ask <varname> <question> <default>
# Already-exported env vars win over prompts; defaults win in CI mode.
ask() {
  local name="$1" question="$2" default="$3" reply=""
  local current
  current="$(eval "printf '%s' \"\${${name}:-}\"")"
  if [ -n "$current" ]; then
    return 0
  fi
  if [ "$NONINTERACTIVE" = "1" ]; then
    eval "${name}=\"\${default}\""
    return 0
  fi
  read -r -p "${question} [${default}]: " reply || true
  reply="${reply:-$default}"
  eval "${name}=\"\${reply}\""
}

# confirm <varname> <question> <default Y|N>
confirm() {
  local name="$1" question="$2" default="$3" reply="" current
  current="$(eval "printf '%s' \"\${${name}:-}\"")"
  if [ -n "$current" ]; then
    return 0
  fi
  if [ "$NONINTERACTIVE" = "1" ]; then
    eval "${name}=\"\${default}\""
    return 0
  fi
  read -r -p "${question} [${default}]: " reply || true
  reply="${reply:-$default}"
  eval "${name}=\"\${reply}\""
}

is_yes() {
  case "${1:-}" in
    [Yy]*) return 0 ;;
    *) return 1 ;;
  esac
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
  fi
}

test_postgres() {
  # Pass the connection string through the environment, never through argv:
  # process lists are world-readable on multi-user machines.
  DATABASE_URL="$1" node --input-type=module -e "
const { Pool } = await import('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  await pool.query('SELECT 1');
  process.exitCode = 0;
} catch (error) {
  console.error(String(error.message || error));
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
"
}

say "=============================================="
say " Orbit Focus 服务器版 一键部署向导"
say "=============================================="
say ""

# ---------- 1. 环境检查 ----------
if ! command -v node >/dev/null 2>&1; then
  say "[失败] 未找到 node。请先安装 Node.js 20 或更高版本 (https://nodejs.org)。"
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  say "[失败] 需要 Node.js >= 20，当前版本 $(node -v)。"
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  say "[失败] 未找到 npm。"
  exit 1
fi
say "[通过] Node.js $(node -v)"

# ---------- 2. 依赖安装 ----------
confirm INSTALL_DEPS "是否安装/更新 npm 依赖 (npm install)" "Y"
if is_yes "$INSTALL_DEPS"; then
  say "安装依赖中..."
  npm install
else
  say "[跳过] 依赖安装"
fi

# ---------- 3. 数据库选择 ----------
say ""
say "请选择数据库 (DB_CLIENT):"
say "  1) SQLite     - 零配置单文件数据库，适合个人与小团队部署（默认）"
say "  2) PostgreSQL - 需要已有数据库服务，适合多用户高并发部署"
ask DB_CHOICE "输入编号 [1/2]" "1"
case "$DB_CHOICE" in
  2) DB_CLIENT="postgres" ;;
  *) DB_CLIENT="sqlite" ;;
esac
export DB_CLIENT

SQLITE_PATH_DEFAULT="data/orbit-focus.db"
DATABASE_URL_DEFAULT="postgres://postgres:postgres@localhost:5432/orbit_focus"

if [ "$DB_CLIENT" = "sqlite" ]; then
  ask SQLITE_PATH "SQLite 数据库文件路径（相对于项目根目录）" "$SQLITE_PATH_DEFAULT"
  DATABASE_URL=""
  say "[信息] 使用 SQLite: ${SQLITE_PATH}"
else
  ask DATABASE_URL "PostgreSQL 连接串 (DATABASE_URL)" "$DATABASE_URL_DEFAULT"
  say "测试 PostgreSQL 连接..."
  if test_postgres "$DATABASE_URL"; then
    say "[通过] PostgreSQL 连接成功，服务启动时将初始化最新 schema"
  else
    say "[失败] 无法连接该 PostgreSQL。请确认地址、账号、库名，或改选 SQLite 后重新运行。"
    exit 1
  fi
fi

# ---------- 4. 运行配置 ----------
say ""
ask PORT "监听端口" "3000"
confirm PRODUCTION "按生产模式部署吗 (NODE_ENV=production)?" "N"
if is_yes "$PRODUCTION"; then
  NODE_ENV_VALUE="production"
else
  NODE_ENV_VALUE="development"
fi

# JWT secret: never reuse the previous placeholder value.
ask JWT_SECRET "JWT 签名密钥（留空自动生成随机密钥；生产模式必须为固定值）" ""
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET="$(generate_secret)"
  say "[信息] 已生成随机 JWT_SECRET"
fi

# ---------- 5. GitHub OAuth（可选） ----------
say ""
confirm OAUTH "是否配置 GitHub 登录 (OAuth App)?" "N"
GITHUB_CLIENT_ID_VALUE=""
GITHUB_CLIENT_SECRET_VALUE=""
PUBLIC_ORIGIN_VALUE=""
if is_yes "$OAUTH"; then
  ask GITHUB_CLIENT_ID_VALUE "GitHub OAuth Client ID" ""
  ask GITHUB_CLIENT_SECRET_VALUE "GitHub OAuth Client Secret" ""
  ask PUBLIC_ORIGIN_VALUE "对外访问地址 (PUBLIC_ORIGIN，例如 https://focus.example.com)" ""
  if [ -n "$PUBLIC_ORIGIN_VALUE" ]; then
    say "[提醒] 请在 GitHub OAuth App 中把回调地址设置为:"
    say "       ${PUBLIC_ORIGIN_VALUE%/}/api/auth/github/callback"
  else
    say "[提醒] 部署后回调地址为 <你的域名>/api/auth/github/callback，"
    say "       需要与 GitHub OAuth App 配置一致。"
  fi
else
  say "[信息] 跳过 GitHub OAuth。服务器仍可运行，数据保存在浏览器本地。"
fi

# ---------- 6. 构建前端 ----------
say ""
if [ "$NODE_ENV_VALUE" = "production" ]; then
  confirm BUILD_CLIENT "是否构建前端静态文件 (vite build)?" "Y"
else
  confirm BUILD_CLIENT "是否构建前端静态文件 (本地开发可跳过，由 Vite dev server 提供)?" "N"
fi
if is_yes "$BUILD_CLIENT"; then
  say "构建前端中..."
  npm run build:client
  say "[通过] 前端构建完成 (dist/)"
else
  say "[跳过] 前端构建"
fi

# ---------- 7. 写入 server/.env ----------
if [ -f "$ENV_FILE" ]; then
  BACKUP_FILE="${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  cp "$ENV_FILE" "$BACKUP_FILE"
  # cp keeps the source mode; the backup holds secrets just like the original.
  chmod 600 "$BACKUP_FILE"
  say "[信息] 已备份原配置到 ${BACKUP_FILE} (权限 600)"
fi
mkdir -p server
# Create with 0600 up-front so the heredoc never lands in a world-readable file.
install -m 600 /dev/null "$ENV_FILE"
cat > "$ENV_FILE" <<EOF
# Generated by setup-server.sh at $(date -u +%Y-%m-%dT%H:%M:%SZ)
NODE_ENV=${NODE_ENV_VALUE}
PORT=${PORT}
DB_CLIENT=${DB_CLIENT}
SQLITE_PATH=${SQLITE_PATH:-$SQLITE_PATH_DEFAULT}
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID_VALUE}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET_VALUE}
PUBLIC_ORIGIN=${PUBLIC_ORIGIN_VALUE}
EOF
chmod 600 "$ENV_FILE"
say ""
say "[通过] 配置已写入 ${ENV_FILE} (权限 600)"

# ---------- 8. 启动 ----------
say ""
confirm START_NOW "是否立即启动服务器?" "Y"
if is_yes "$START_NOW"; then
  say "启动: npm run start:server  (Ctrl+C 停止)"
  exec npm run start:server
fi

say ""
say "=============================================="
say " 部署准备完成。后续步骤："
say "   1. 启动服务:  npm run start:server"
say "   2. 前台开发:  npm run dev        (Vite + 热重载)"
if [ "$NODE_ENV_VALUE" = "production" ]; then
  say "   3. 建议用 systemd 或 pm2 守护进程，并在前面挂 Nginx/Caddy 做 HTTPS"
fi
say "   配置文件: ${ENV_FILE}，修改后重启服务生效"
say "=============================================="
