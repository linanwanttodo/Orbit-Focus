# 本地开发指南

本文档介绍如何在本地搭建和运行 Orbit Focus 的开发环境。

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | 20+ | 前端构建与后端运行（JWT 依赖 Web Crypto 全局对象） |
| npm | 10.x | 随 Node.js 附带 |
| SQLite | 无需单独安装 | 默认数据库，通过 better-sqlite3 内嵌运行 |
| PostgreSQL | 可选 | `DB_CLIENT=postgres` 时连接已有实例，无需 Docker |

可选：GitHub OAuth App（本地联调登录时）、Cloudflare 账号 + wrangler CLI（调试 Workers 版后端时）。

## 安装依赖

```bash
git clone https://github.com/linanwanttodo/Orbit-Focus.git
cd Orbit-Focus
npm install
```

## 环境变量

本地开发也可以直接用引导式脚本生成配置（会顺带装依赖并可选启动）：

```bash
bash setup-server.sh
```

手动方式：

```bash
cp server/.env.example server/.env
```

| 变量 | 说明 |
|------|------ |
| `PORT` | Express 端口，默认 3000 |
| `DB_CLIENT` | `sqlite`（默认）或 `postgres` |
| `SQLITE_PATH` | SQLite 文件路径，默认 `data/orbit-focus.db` |
| `DATABASE_URL` | PostgreSQL 连接串（`DB_CLIENT=postgres` 时） |
| `JWT_SECRET` | 缺省时生成随机临时密钥并打印告警（重启后登录态失效）；`NODE_ENV=production` 时缺失将拒绝启动 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth App 凭据，缺省时登录接口返回 501 |
| `PUBLIC_ORIGIN` | 建议设为 `http://localhost:5173`（OAuth 回调经 Vite 代理转发回 3000） |

注意：`server/.env` 中的 `DB_CLIENT=postgres` 仅影响自托管 Express；`wrangler dev`（Workers 本地）始终使用 D1 模拟器。

GitHub OAuth App 的回调地址登记为 `http://localhost:5173/api/auth/github/callback`。

## 启动开发环境

### 一键启动（推荐）

```bash
npm run dev
```

同时启动两个进程：

| 进程 | 端口 | 说明 |
|------|------|------|
| client | 5173 | Vite 开发服务器，访问 http://localhost:5173 |
| server | 3000 | Express API（薄适配层，业务在 `api/core/`），前端 `/api` 经 Vite 代理转发 |

### 分离启动

```bash
npm run dev:client   # 只启动前端
npm run dev:server   # 只启动后端（tsx watch，文件变更自动重启）
```

## 数据模式

- 未登录：任务 / 会话 / 重要日期全部存浏览器 localStorage，不发 API 请求；统计在前端本地计算
- 登录后：读写服务端数据库（本地 Express 为 SQLite / PostgreSQL，Worker 为 D1），按 `user_id` 隔离；首次登录自动把本地数据 upsert 上云
- 本地 SQLite 文件默认位于 `data/orbit-focus.db`（已 gitignore，路径可用 `SQLITE_PATH` 覆盖）；服务启动时自动执行未应用的迁移，旧库原地升级

表结构的唯一来源是 `api/core/schema.ts` 的有序迁移列表（记账于 `schema_migrations` 表）；`api/cloudflare/schema.sql` 仅用于全新 D1 的一次性初始化。给表加字段的方法见[架构说明 - 如何给数据表加字段](architecture.md)。

## 代码校验

```bash
npm run validate        # 前端 + 服务端/核心 + Worker 三套 tsconfig 类型检查 + ESLint
npm run validate:client # 只查前端
npm run lint            # ESLint 全仓库
npm run lint:fix        # ESLint 自动修复
```

提交前建议 `npm run validate` 通过（0 errors；warning 为历史遗留的 `no-explicit-any` 等，可暂不处理）。

注意：`api/cloudflare` 的 tsconfig 与 `tsconfig.server.json` 均纳入类型检查，这是防止"前端与部署端字段契约漂移"（历史上 streak 字段名不一致事故）的关键防线。

## 构建生产版本

```bash
npm run build          # vite 构建前端 + tsc 类型检查（不再产出 server/dist，本地跑 tsx）
npm run build:client   # 只构建前端，产物在 dist/
```

## 调试 Workers 版后端（可选）

如需在本地以 Cloudflare Workers 运行时调试后端（secrets 放 `.dev.vars`）：

```bash
npm run cf:db:init:local   # 初始化本地 D1（模拟器）
npm run cf:dev             # 启动 wrangler dev，访问 http://localhost:8787
```

## 常见问题

**端口被占用**：Vite 固定 5173，Express 固定 3000，`wrangler dev` 固定 8787。

**文件变更不触发热更新**：项目启用了轮询监听（`usePolling`），规避部分 Linux 系统 inotify 上限过低导致的 ENOSPC。

**API 请求 401**：localStorage 中的令牌过期、被手动改坏，或服务端更换了 `JWT_SECRET`；退出登录（导航栏头像按钮）即可清除。

**开发时服务重启后要重新登录**：未设置 `JWT_SECRET` 时每次启动生成随机临时密钥。在 `server/.env` 固定一个即可。

**API 请求 404（开发模式）**：确认 3000 端口的 Express 已启动；Vite 代理只在开发模式生效。

**登录后统计为 0**：确认云端确有数据；游客期的本地数据只有在"首次登录"时才会迁移，重复登录不会再次迁移。
