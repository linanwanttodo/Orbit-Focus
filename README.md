# Orbit Focus - 全栈番茄钟应用

Orbit Focus 是一个 React + TypeScript 全栈番茄钟应用。数据支持双模式：游客全部存本地（localStorage），登录后云端同步。后端逻辑收口在平台无关的 API 核心（`api/core/`），Cloudflare Workers（D1）与自托管 Express（SQLite / PostgreSQL）只是两个薄适配层。

## 技术栈

### 前端
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui（Radix）
- Context：多语言（中 / 英 / 俄）、主题、认证状态

### 后端
- `api/core/`：平台无关 API 核心，仅依赖 Web 标准 `Request` / `Response` 与 `DbAdapter` 接口
- 线上：Cloudflare Workers + D1
- 自托管：Express，数据库可选 SQLite（默认，零配置）或 PostgreSQL（`DB_CLIENT` 切换）
- Schema：`api/core/schema.ts` 中带方言的有序迁移，启动时自动应用，新增字段只需追加迁移
- 认证：GitHub OAuth + HS256 JWT（Web Crypto 实现，跨运行时，7 天有效期）

## 项目结构

```
Orbit-Focus/
├── api/
│   ├── core/                # 平台无关 API 核心
│   │   ├── handler.ts       # 路由与业务（auth / tasks / sessions / countdowns / stats）
│   │   ├── jwt.ts           # JWT 签发与校验（Web Crypto）
│   │   ├── github.ts        # GitHub OAuth 交换
│   │   ├── stats.ts         # 连续天数 / 近 7 天等纯函数
│   │   ├── schema.ts        # 带方言的有序迁移（schema_migrations 记账，支持后续加字段）
│   │   └── types.ts         # DbAdapter 等共享类型
│   └── cloudflare/          # Worker 适配层（D1 -> DbAdapter）+ schema.sql
├── server/                  # 自托管 Express 适配层（SQLite / PostgreSQL -> DbAdapter）
├── client/src/
│   ├── components/          # UI 组件（ui/ 为 shadcn 基件）
│   ├── contexts/            # AuthContext / I18nContext / ThemeContext
│   ├── hooks/useTimerState.ts
│   ├── lib/stats.ts         # 游客模式本地统计
│   ├── services/
│   │   ├── apiService.ts    # 云端 API 封装（自动附带 Bearer 令牌）
│   │   └── store.ts         # 数据层：登录走云端，游客走 localStorage
│   └── App.tsx              # 根组件：视图切换、导航、全局错误
├── data/                    # 本地 SQLite（gitignore）
├── docs/                    # 开发 / 架构 / 部署文档
├── setup-cloudflare.sh      # Cloudflare 一键部署
├── setup-server.sh          # 自托管服务器引导式一键部署
├── vite.config.ts           # 开发代理 /api -> :3000
└── wrangler.toml            # Cloudflare 部署配置
```

## 功能特性

- 番茄钟与自定义倒计时（结束自动记录专注会话）
- 重要日期倒计时（考试、截止日，展示剩余天数，按到期排序）
- 待办任务列表
- 统计：今日专注、周合计、连续学习天数、年度热力日历
- GitHub 登录 + 游客本地模式；首次登录自动把本地数据迁移上云
- 数据按用户隔离（所有表含 `user_id`，越权读写被服务端拒绝）
- 多语言（中 / 英 / 俄）、深浅主题、禅模式与全屏

## 安装与运行

```bash
# 1. 安装依赖
npm install

# 2. 可选：启用 GitHub 登录（跳过则游客模式照常可用）
#    或直接运行引导式脚本，交互式生成 server/.env 并启动
bash setup-server.sh

# 3. 开发模式（Vite :5173 + Express :3000，/api 自动代理）
npm run dev
```

## 环境变量

### 服务器 / 本地开发（server/.env）

| 变量 | 说明 |
|------|------|
| `PORT` | Express 端口，默认 3000 |
| `DB_CLIENT` | `sqlite`（默认）或 `postgres` |
| `SQLITE_PATH` | SQLite 文件路径（`DB_CLIENT=sqlite`），默认 `data/orbit-focus.db` |
| `DATABASE_URL` | PostgreSQL 连接串（`DB_CLIENT=postgres`），也支持标准 `PG*` 环境变量 |
| `JWT_SECRET` | JWT 签名密钥；生产必填（缺失则拒绝启动），开发缺省时每次启动随机生成（重启会使登录态失效） |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth App 凭据 |
| `PUBLIC_ORIGIN` | OAuth 重定向使用的公网源，如 `http://localhost:5173` |

### Cloudflare 部署（secrets，勿写入 wrangler.toml）

```bash
wrangler secret put JWT_SECRET
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
```

本地 `wrangler dev` 调试 Worker 时，凭据放 `.dev.vars`（已 gitignore）。

## 部署

### 自托管服务器（Express，SQLite / PostgreSQL）

```bash
# 引导式一键：检查环境 -> 装依赖 -> 选数据库 -> 生成密钥 -> 写 server/.env -> 构建并启动
bash setup-server.sh
# 非交互（全部默认值）：
bash setup-server.sh --yes

# 之后随时手动启动
npm run start:server
```

数据库表结构与服务端代码同步演进：服务启动时自动执行 `api/core/schema.ts` 中未应用的迁移，旧库（含迁移前无 `user_id` 列的历史数据）可原地升级。

### Cloudflare Workers

```bash
# 一键初始化 + 部署
npm run setup
```

或手动分步，详见 [部署指南](docs/deployment.md)。GitHub OAuth App 的回调地址需配置为：

```
https://<你的域名>/api/auth/github/callback
```

## API 端点

### 认证
- `GET /api/auth/github` - 跳转 GitHub 授权
- `GET /api/auth/github/callback` - OAuth 回调（成功后重定向 `/auth-done#token=...`，前端一次性接收令牌）
- `GET /api/auth/me` - 当前用户信息

### 任务（需登录）
- `GET /api/tasks` - 当前用户任务列表
- `POST /api/tasks` - 创建 / upsert 任务（支持客户端指定 `id`）
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务

### 会话（需登录）
- `GET /api/sessions` - 会话列表
- `POST /api/sessions` - 记录会话（支持客户端指定 `id`，重复 id 幂等）
- `PUT /api/sessions/:id` / `DELETE /api/sessions/:id`
- `GET /api/sessions/stats` - 当前用户聚合统计

### 重要日期（需登录）
- `GET /api/countdowns` - 列表
- `POST /api/countdowns` - 创建 / upsert
- `PUT /api/countdowns/:id` / `DELETE /api/countdowns/:id`

### 其他
- `GET /api/health` - 健康检查

## 文档

| 文档 | 内容 |
|------|------|
| [本地开发指南](docs/development.md) | 环境搭建、启动、校验、常见问题 |
| [架构说明](docs/architecture.md) | 核心层设计、认证流程、API、数据模型 |
| [部署指南](docs/deployment.md) | 自托管服务器（SQLite / PostgreSQL）与 Cloudflare Workers 部署 |

## 安全说明

- 所有数据接口强制鉴权，SQL 全部参数化，服务端按 `user_id` 隔离数据
- upsert 带属主校验（`ON CONFLICT ... WHERE <table>.user_id = excluded.user_id`），用他人记录 id 提交写入会被静默拒绝
- GitHub OAuth 的 `state` 同时通过 httpOnly Cookie 绑定发起授权的浏览器，防止登录 CSRF（诱导受害者登录到攻击者账号）
- 会话令牌有效期 7 天；缺少 `JWT_SECRET` 时 Worker 返回 503、Express 生产模式拒绝启动（无硬编码回退密钥，开发模式使用随机临时密钥）
- 输入校验：ID 格式白名单、标题长度上限、会话类型与时长范围校验
- 未实现：请求频率限制（依赖 Cloudflare 层 / 反代防护）、令牌撤销机制

## 许可证

MIT
