# 部署指南

Orbit Focus 有两种部署目标：

1. Cloudflare Workers + D1
2. Docker 私有化部署（Express + SQLite/PostgreSQL）

两种方式共用 `api/core` 业务代码和前端构建产物。

## 一、Cloudflare Workers + D1

### 1. 准备工具

```bash
npm install
npx wrangler login
npx wrangler whoami
```

项目使用 `wrangler.toml`，D1 binding 名称是 `orbit_focus_db`。

### 2. 创建全新的 D1 数据库

本版本使用全新 schema，不兼容旧数据库。由于当前没有需要保留的数据，推荐删除旧的空数据库后重新创建。

先查看数据库：

```bash
npx wrangler d1 list
```

如果确认旧数据库没有需要保留的数据：

```bash
npx wrangler d1 delete orbit_focus_db
npx wrangler d1 create orbit_focus_db
```

把命令输出的 `database_id` 写入 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "orbit_focus_db"
database_name = "orbit_focus_db"
database_id = "这里填新的 database_id"
```

然后执行最新 schema：

```bash
npx wrangler d1 execute orbit_focus_db --remote --file=./api/cloudflare/schema.sql
```

也可以使用项目脚本：

```bash
bash setup-cloudflare.sh
```

脚本会检测旧的 `schema_migrations` 表并停止，避免误把新 schema 当成旧库升级。

### 3. 配置 Worker secrets

以下命令会进入交互式输入，不要把密钥直接写进命令或仓库：

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
```

`JWT_SECRET` 必填。GitHub OAuth 不配置时，游客模式仍然可用。

### 4. 配置 GitHub OAuth App

在 GitHub Developer settings → OAuth Apps 创建应用。

如果使用 Worker 默认域名，回调地址为：

```text
https://<worker-domain>/api/auth/github/callback
```

如果使用自定义域名，则使用自定义域名对应的地址。

### 5. 构建和部署

```bash
npm run validate
npm test
npm run build
npx wrangler deploy
```

部署后验证：

```bash
curl https://<worker-domain>/api/health
```

返回 `status: ok` 后打开站点测试游客模式、GitHub 登录、任务看板和未来日期。

### 6. Cloudflare 常见问题

**API 返回 503**：Worker 没有 `JWT_SECRET`，执行 `npx wrangler secret put JWT_SECRET` 后重新部署或等待 secret 生效。

**登录返回 501**：没有配置 GitHub OAuth 两个 secret，或 GitHub 回调地址不一致。

**数据库提示旧字段**：当前版本不做旧库迁移，删除并重新创建 D1 后执行新的 schema 文件。

**D1 数据备份**：

```bash
npx wrangler d1 export orbit_focus_db --remote --output backup.sql
```

不要把导出的数据文件或 secrets 提交到 Git。

## 二、Docker 私有化部署

完整说明见 [Docker 私有化部署](docker-deployment.md)。

快速开始：

```bash
cp .env.docker.example .env
# 编辑 .env，至少填写 JWT_SECRET
docker compose up -d --build
curl http://127.0.0.1:3000/api/health
```

默认数据库文件位于宿主机：

```text
./data/orbit-focus.db
```

## 三、自托管 Express（不使用 Docker）

```bash
cp server/.env.example server/.env
npm install
npm run build:client
NODE_ENV=production npm run start:server
```

公网部署建议：

- 使用 Nginx/Caddy 提供 HTTPS
- 使用 systemd 或 pm2 守护进程
- 设置 `PUBLIC_ORIGIN=https://你的域名`
- GitHub 回调地址为 `https://你的域名/api/auth/github/callback`
- 定期备份 `data/orbit-focus.db`

当前版本按新数据库启动，旧 SQLite 文件不会被自动迁移。若要采用新结构，请先备份并删除旧文件。
