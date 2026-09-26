# 本地开发指南

## 环境要求

- Node.js 20+
- npm 10+
- SQLite 无需单独安装，默认通过 better-sqlite3 内嵌运行
- PostgreSQL 可选
- Cloudflare 账号和 Wrangler CLI 只有调试 Worker 时需要

## 安装和启动

```bash
npm install
npm run dev
```

启动两个进程：

| 进程 | 端口 | 说明 |
|---|---:|---|
| Vite | 5173 | 前端开发服务器 |
| Express | 3000 | API，访问 `/api` 由 Vite 代理 |

也可以分开启动：

```bash
npm run dev:client
npm run dev:server
```

打开 `http://localhost:5173`。

## 环境变量

本地开发可以不设置 `JWT_SECRET`，服务会生成临时密钥，重启后登录态失效。需要稳定登录态时，在 `server/.env` 设置：

```env
JWT_SECRET=请使用随机长字符串
```

GitHub OAuth 可选：

```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
PUBLIC_ORIGIN=http://localhost:5173
```

不配置 GitHub OAuth 时，游客模式仍可使用。

## 数据模式

- 未登录：数据只保存在浏览器版本化 localStorage
- 登录后：数据写入 SQLite/PostgreSQL/D1，并按用户隔离
- 当前版本不迁移旧数据库和旧 localStorage 数据
- 本地 SQLite 默认位置：`data/orbit-focus.db`
- 启动时执行最新 `initializeSchema()`，要求数据库为空或已经是当前结构

## 校验和测试

```bash
npm run validate       # 前端、服务端、Worker 类型检查 + ESLint
npm test               # Node 内置测试运行器
npm run build          # 前端构建 + 服务端类型检查
```

单独执行：

```bash
npm run validate:client
npm run build:client
node --import tsx --test tests/task-api.test.ts
```

测试文件位于 `tests/`，覆盖数据库初始化、用户隔离、任务状态、session 时区统计、计时器 deadline 和看板统计。

## Cloudflare Workers 本地调试

```bash
npx wrangler d1 execute orbit_focus_db --local --file=./api/cloudflare/schema.sql
npm run cf:dev
```

本地 Worker 默认使用 Wrangler 模拟的 D1。`.dev.vars` 只放本机 secrets，不提交。

## Docker

Docker 私有化部署请看 [Docker 部署文档](docker-deployment.md)：

```bash
cp .env.docker.example .env
docker compose up -d --build
curl http://127.0.0.1:3000/api/health
```

## 常见问题

**端口被占用**：Vite 使用 5173，Express 使用 3000，Wrangler 使用 8787。

**API 401**：JWT 过期或服务重启导致临时密钥变化，退出登录后重试。

**登录后统计为 0**：确认首次登录前有游客数据；新版本不会迁移旧格式数据。

**数据库报 no such column**：当前版本使用全新 schema，删除旧的空数据库/SQLite 文件后重新启动。

**文件变更不触发 HMR**：Vite 已使用轮询监听，避免 Linux inotify 限制。
