# 部署指南

Orbit Focus 有两种部署目标：

1. **自托管服务器**（Express，数据库可选 SQLite / PostgreSQL）——适合拥有一台 VPS 或 NAS 的场景
2. **Cloudflare Workers + D1** —— 免运维的 serverless 选项

两种方式共用同一套 `api/core` 业务代码与迁移框架，数据模型完全一致。

## 自托管服务器部署（推荐路径：引导式脚本）

### 前置要求

- Linux / macOS，Node.js 20+
- （选 PostgreSQL 时）一个可访问的 PostgreSQL 服务；SQLite 无需任何外部服务

### 一键向导

```bash
bash setup-server.sh          # 交互式
bash setup-server.sh --yes    # 非交互，全部默认值（SQLite + 端口 3000 + 随机密钥）
```

脚本会依次完成：环境检查 -> `npm install` -> 选择数据库（1 SQLite / 2 PostgreSQL，PG 会先做连接测试）-> 端口 -> 生成 `JWT_SECRET`（`openssl rand -hex 32`，可自定义）-> 可选配置 GitHub OAuth -> 可选构建前端 -> 把配置写入 `server/.env`（权限 600，旧文件自动备份）-> 询问是否立即启动。

已存在的环境变量优先于提问，可在 CI / 预置场景直接注入：

```bash
DB_CLIENT=postgres DATABASE_URL=postgres://user:pw@db:5432/orbit \
JWT_SECRET=$(openssl rand -hex 32) PORT=8080 bash setup-server.sh --yes
```

### 手动方式

```bash
cp server/.env.example server/.env   # 按需修改 DB_CLIENT / JWT_SECRET / OAuth 凭据
npm install
npm run build:client                 # 生产部署需要（开发时由 Vite 提供前端）
NODE_ENV=production npm run start:server
```

- 数据库表结构与索引在服务启动时自动迁移（`schema_migrations` 记账），升级新版本代码后重启即完成数据库演进，旧 SQLite 文件可原地升级。
- 生产模式下 `NODE_ENV=production` 且未设置 `JWT_SECRET` 时进程会拒绝启动。
- 公网部署建议在前面挂 Nginx / Caddy 做 HTTPS，并用 systemd 或 pm2 守护；`PUBLIC_ORIGIN` 填对外 HTTPS 域名，GitHub OAuth 回调地址为 `<PUBLIC_ORIGIN>/api/auth/github/callback`。
- systemd 服务示例（`/etc/systemd/system/orbit-focus.service`）：

```
[Unit]
Description=Orbit Focus server
After=network.target

[Service]
WorkingDirectory=/opt/Orbit-Focus
ExecStart=/usr/bin/npm run start:server
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### 数据库选择建议

| 场景 | 选择 |
|------|------|
| 个人使用、单文件备份、零配置 | SQLite（默认） |
| 多用户、需要并发写入 / 集中备份 / 主从 | PostgreSQL |
| Cloudflare 平台 | D1（走 Worker 部署路径） |

MySQL 暂未内置；由于核心 SQL 已限制在公共子集，参照 `server/src/database.ts` 增加一个驱动分支即可。

## Cloudflare Workers 部署

### 前置要求

- Node.js 20+
- Cloudflare 账号
- wrangler CLI：`npm install -g wrangler`
- 已登录 Cloudflare：`wrangler login`
- （可选，启用 GitHub 登录）GitHub OAuth App：Settings -> Developer settings -> OAuth Apps -> New OAuth App，回调地址填 `https://<你的 Worker 域名>/api/auth/github/callback`

### 第一步：部署 Worker 与 D1

```bash
# 一键：建库、初始化 schema、构建、部署
npm run setup
```

脚本（`setup-cloudflare.sh`）会检查 wrangler 登录状态、创建 D1 数据库（如 `wrangler.toml` 中尚无 `database_id`）、把 `database_id` 写回配置、初始化 schema、构建并部署。

手动分步：

```bash
wrangler d1 create orbit_focus_db      # 将 database_id 填入 wrangler.toml
npm run cf:db:init                     # 初始化远程 schema（老库也可跳过，运行时会自动迁移）
npm run cf:deploy                      # 构建前端并部署 Worker
```

### 第二步：配置 Secrets（必须）

Worker 在缺少 `JWT_SECRET` 时会拒绝提供 API（503）。使用 `wrangler secret put` 注入，不要把密钥写进 `wrangler.toml`：

```bash
wrangler secret put JWT_SECRET         # 建议值：openssl rand -hex 32
wrangler secret put GITHUB_CLIENT_ID   # 可选，不配则登录返回 501，游客模式不受影响
wrangler secret put GITHUB_CLIENT_SECRET
```

### 第三步：验证

```bash
curl https://<worker 域名>/api/health   # {"status":"ok",...}
```

浏览器打开站点，导航栏出现登录按钮且点击可跳转 GitHub 授权即完成。

## 本地 Workers 预览

在提交部署前，可用 wrangler 在本地以 Workers 运行时验证（ secrets 放项目根目录 `.dev.vars`，已 gitignore）：

```bash
npm run cf:db:init:local   # 初始化本地 D1 模拟器
npm run cf:dev             # 启动本地 Workers，访问 http://localhost:8787
npm run cf:tail            # 实时查看线上 Worker 日志
```

`.dev.vars` 示例：

```
JWT_SECRET="dev-secret-replace-me"
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
```

## GitHub Actions 自动部署

仓库已配置 `.github/workflows/deploy.yml`：

- 触发条件：push 到 `main` 分支，或手动触发（workflow_dispatch）
- 流程：checkout -> Node 20 -> `npm install` -> `npm run build` -> `cloudflare/wrangler-action@v3` 部署

需要在仓库 Settings -> Secrets and variables -> Actions 中配置：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token，需具备 Workers 部署与 D1 权限 |

注意：Actions 只负责部署代码，Worker 运行时的 `JWT_SECRET` 等 secrets 是 Cloudflare 侧资源，只需配置一次，不由 Actions 注入。

## 配置参考（wrangler.toml）

| 配置 | 值 | 说明 |
|------|-----|------|
| `name` | orbit-focus | Worker 名称 |
| `main` | api/cloudflare/index.ts | Workers 入口 |
| `[assets] directory` | dist | 前端构建产物目录 |
| `[assets] not_found_handling` | single-page-application | SPA 路由回退（含 `/auth-done`） |
| `[[d1_databases]] binding` | orbit_focus_db | D1 绑定名，代码通过 `env.orbit_focus_db` 访问 |
| `[dev] port` | 8787 | wrangler dev 本地端口 |

## 常见问题

**自托管启动即报 `Unsupported DB_CLIENT`**：`DB_CLIENT` 只支持 `sqlite` 或 `postgres`。

**自托管重启后所有人都要重新登录**：未设置 `JWT_SECRET` 时开发模式使用随机临时密钥。在 `server/.env` 固定一个 `JWT_SECRET`。

**自托管生产启动报 `JWT_SECRET must be set when NODE_ENV=production`**：这是 fail-closed 保护，在 `server/.env` 写入 `JWT_SECRET`（`openssl rand -hex 32` 生成）后重启。

**换了 `DB_CLIENT` 后数据“消失”**：两种数据库各自独立存储，确认 `SQLITE_PATH` / `DATABASE_URL` 指向原库即可，不会互相覆盖。

**API 全部返回 503（Server misconfigured）**：未设置 `JWT_SECRET` secret，执行 `wrangler secret put JWT_SECRET`。

**点击登录返回 501**：未配置 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`，或 GitHub OAuth App 回调地址与当前域名不一致。

**登录后数据为空**：确认数据是登录前以游客身份产生的——首次登录会触发一次本地 -> 云端迁移；若在迁移前清过浏览器数据则无处可迁。

**Actions 部署失败（鉴权错误）**：检查 `CLOUDFLARE_API_TOKEN` 是否有效、权限模板是否包含 Workers Scripts:Edit 与 D1:Edit。

**静态资源 404**：确认部署前已执行 `npm run build` 生成 `dist/`（`cf:deploy` 脚本已内置构建步骤）。
