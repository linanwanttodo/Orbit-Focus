#!/bin/bash
set -e

# ============================================================
# Orbit Focus - Cloudflare 自动化部署脚本
# 功能：创建 D1 数据库、初始化 schema、部署 Worker
# 兼容 macOS 和 Linux
# ============================================================

WORKER_NAME="orbit-focus"
DB_NAME="orbit-focus-db"
SCHEMA_FILE="./api/cloudflare/schema.sql"

echo "🚀 Orbit Focus - Cloudflare 部署脚本"
echo "======================================"

# 检查 wrangler 是否安装
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler 未安装，请先运行: npm install -g wrangler"
    exit 1
fi

# 检查是否已登录
echo "🔍 检查 Cloudflare 登录状态..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ 未登录 Cloudflare，请运行: wrangler login"
    exit 1
fi
echo "✅ 已登录 Cloudflare"

# 提取 database_id（兼容 macOS 和 Linux）
# 使用 sed 替代 grep -oP（BSD grep 不支持 -P 参数）
EXISTING_ID=$(sed -n 's/.*database_id[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' wrangler.toml 2>/dev/null | head -1 || true)

if [ -n "$EXISTING_ID" ] && [ "$EXISTING_ID" != "YOUR_DATABASE_ID_HERE" ]; then
    echo "✅ 已配置 database_id: $EXISTING_ID"
    DATABASE_ID="$EXISTING_ID"
else
    echo "📦 创建 D1 数据库..."
    CREATE_OUTPUT=$(wrangler d1 create "$DB_NAME" 2>&1)
    echo "$CREATE_OUTPUT"

    # 从输出中提取 database_id（兼容 macOS 和 Linux）
    DATABASE_ID=$(echo "$CREATE_OUTPUT" | sed -n 's/.*database_id[[:space:]]*=[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)

    if [ -z "$DATABASE_ID" ]; then
        echo "❌ 无法自动提取 database_id"
        echo "请手动运行: wrangler d1 create $DB_NAME"
        echo "然后将输出中的 database_id 添加到 wrangler.toml"
        exit 1
    fi

    echo "✅ 数据库已创建: $DATABASE_ID"

    # 使用 awk 更新 wrangler.toml（跨平台兼容）
    awk -v db_id="$DATABASE_ID" -v db_name="$DB_NAME" '
    /^\[\[d1_databases\]\]/ {
        print "[[d1_databases]]"
        print "binding = \"DB\""
        print "database_name = \"" db_name "\""
        print "database_id = \"" db_id "\""
        skip = 1
        next
    }
    skip && /^\[/ { skip = 0 }
    !skip { print }
    ' wrangler.toml > /tmp/wrangler_tmp.toml && mv /tmp/wrangler_tmp.toml wrangler.toml

    echo "✅ wrangler.toml 已更新"
fi

# 初始化数据库 schema
echo "📊 初始化数据库 schema..."
wrangler d1 execute "$DB_NAME" --remote --file="$SCHEMA_FILE"
echo "✅ 数据库 schema 初始化完成"

# 构建前端
echo "🔨 构建前端..."
npm run build:client
echo "✅ 前端构建完成"

# 部署 Worker
echo "🚀 部署 Worker..."
wrangler deploy
echo "✅ Worker 部署完成"

# 输出部署信息
echo ""
echo "======================================"
echo "🎉 部署成功！"
echo "======================================"
echo ""
echo "📌 Worker URL: https://${WORKER_NAME}.<your-subdomain>.workers.dev"
echo "📌 数据库 ID: $DATABASE_ID"
echo ""
echo "💡 提示: 你可以配置自定义域名"
echo "   运行: wrangler routes compose"
echo ""
