#!/bin/bash
set -e

# Orbit Focus - Cloudflare 自动化部署脚本
# 创建全新 D1 数据库、初始化最新 schema、部署 Worker。

WORKER_NAME="orbit-focus"
DB_NAME="orbit_focus_db"
SCHEMA_FILE="./api/cloudflare/schema.sql"
WRANGLER=(npx wrangler)

echo "Orbit Focus - Cloudflare 部署脚本"
echo "======================================"

if ! "${WRANGLER[@]}" --version >/dev/null 2>&1; then
    echo "[失败] 无法运行 Wrangler，请确认 Node.js/npm 可用，或执行: npm install -g wrangler"
    exit 1
fi

echo "检查 Cloudflare 登录状态..."
if ! "${WRANGLER[@]}" whoami >/dev/null 2>&1; then
    echo "[失败] 未登录 Cloudflare，请运行: npx wrangler login"
    exit 1
fi
echo "[通过] 已登录 Cloudflare"

EXISTING_ID=$(sed -n 's/.*database_id[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' wrangler.toml 2>/dev/null | head -1 || true)

if [ -n "$EXISTING_ID" ] && [ "$EXISTING_ID" != "YOUR_DATABASE_ID_HERE" ]; then
    echo "[通过] 已配置 database_id: $EXISTING_ID"
    DATABASE_ID="$EXISTING_ID"
else
    echo "[信息] 创建 D1 数据库..."
    CREATE_OUTPUT=$("${WRANGLER[@]}" d1 create "$DB_NAME" 2>&1)
    echo "$CREATE_OUTPUT"

    DATABASE_ID=$(echo "$CREATE_OUTPUT" | sed -n 's/.*database_id[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
    if [ -z "$DATABASE_ID" ]; then
        echo "[失败] 无法自动提取 database_id"
        echo "请手动运行: npx wrangler d1 create $DB_NAME"
        echo "然后将输出中的 database_id 添加到 wrangler.toml"
        exit 1
    fi

    echo "[完成] 数据库已创建: $DATABASE_ID"
    awk -v db_id="$DATABASE_ID" -v db_name="$DB_NAME" '
    /^\[\[d1_databases\]\]/ {
        print "[[d1_databases]]"
        print "binding = \"orbit_focus_db\""
        print "database_name = \"" db_name "\""
        print "database_id = \"" db_id "\""
        skip = 1
        next
    }
    skip && /^\[/ { skip = 0 }
    !skip { print }
    ' wrangler.toml > /tmp/wrangler_tmp.toml && mv /tmp/wrangler_tmp.toml wrangler.toml
    echo "[完成] wrangler.toml 已更新"
fi

# 当前版本按全新数据库基线发布。检测到旧迁移表时停止，避免误以为 schema.sql 会升级旧表。
echo "检查数据库是否为旧 schema..."
OLD_SCHEMA=$("${WRANGLER[@]}" d1 execute "$DB_NAME" --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'" 2>/dev/null || true)
if echo "$OLD_SCHEMA" | grep -q "schema_migrations"; then
    echo "[失败] 检测到旧版 schema_migrations 表。当前版本不兼容旧数据库。"
    echo "   请先备份后删除并重新创建 D1 数据库，再重新运行本脚本。"
    echo "   详情见 docs/deployment.md 的全新 D1 数据库步骤。"
    exit 1
fi

echo "初始化数据库 schema..."
"${WRANGLER[@]}" d1 execute "$DB_NAME" --remote --file="$SCHEMA_FILE"
echo "[完成] 数据库 schema 初始化完成"

echo "检查 Cloudflare secrets..."
SECRET_LIST=$("${WRANGLER[@]}" secret list 2>/dev/null || echo "[]")
if ! echo "$SECRET_LIST" | grep -q '"JWT_SECRET"'; then
    echo "缺少 JWT_SECRET，请运行: npx wrangler secret put JWT_SECRET"
    echo "（GitHub 登录还需要: npx wrangler secret put GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET）"
fi

echo "构建前端..."
npm run build:client
echo "[完成] 前端构建完成"

echo "部署 Worker..."
"${WRANGLER[@]}" deploy
echo "[完成] Worker 部署完成"

echo ""
echo "======================================"
echo "部署成功"
echo "======================================"
echo "  Worker URL: https://${WORKER_NAME}.<your-subdomain>.workers.dev"
echo "  数据库 ID: $DATABASE_ID"
echo ""
echo "提示: 你可以配置自定义域名"
echo "  运行: npx wrangler routes compose"
echo ""
