# 架构说明

本文档描述 Orbit Focus 的整体架构、认证设计、前后端结构与数据模型。

## 总体结构

```
浏览器（React SPA）
    |
    |  REST /api/*  （登录后携带 Authorization: Bearer <JWT>）
    v
API 核心 api/core/handler.ts（平台无关，同一份代码两种运行时）
    ├── Cloudflare Workers：api/cloudflare/index.ts（D1 -> DbAdapter）
    └── 自托管 Express：server/src/index.ts
         └── server/src/database.ts 驱动工厂：
             DB_CLIENT=sqlite    -> better-sqlite3 -> DbAdapter
             DB_CLIENT=postgres  -> pg（? 自动转 $n 占位符）-> DbAdapter
```

关键抽象是 `DbAdapter` 接口（`api/core/types.ts`）：

```ts
interface DbAdapter {
  all(sql, params?): Promise<Row[]>;
  first(sql, params?): Promise<Row | null>;
  run(sql, params?): Promise<void>;
}
```

业务代码只写一份；新增平台时实现 `DbAdapter`，新增数据库引擎时在 `server/src/database.ts` 加一个驱动分支（约束：SQL 只用 SQLite/D1 与 PostgreSQL 的公共子集，占位符统一 `?`）。Vercel 实现已移除（无状态 Serverless 不适合本地文件数据库持久化）。

静态资源：本地由 Vite 托管；线上由 Worker 的 `[assets]` 绑定托管 `dist/`，非 `/api` 请求透传给 ASSETS，SPA 路由回退由 `not_found_handling = "single-page-application"` 完成。

## 认证与数据模式

### GitHub OAuth 流程

1. 前端跳转 `GET /api/auth/github`
2. Worker 签发短期 HMAC `state` 令牌，写入 `HttpOnly; SameSite=Lax` 回调路径 Cookie 后重定向到 GitHub 授权页
3. 回调 `GET /api/auth/github/callback`：`state` 必须与浏览器 Cookie 中的值一致（防登录 CSRF），再校验签名 / 有效期，用 `code` 换 access token，读取 GitHub 资料
4. 服务端签发应用 JWT（HS256，Web Crypto 实现，7 天有效期），重定向 `/auth-done#token=...`
5. 前端 `AuthContext` 一次性从 URL 片段取出令牌存入 localStorage，并把地址栏改回 `/`

JWT 载荷仅含用户 ID / login / 头像；所有数据接口以 `sub`（GitHub 用户 ID）作为 `user_id` 做行级隔离。

### 游客模式（client/src/services/store.ts）

- 未登录时一切数据只读写 localStorage，不发送任何 API 请求
- 首次登录时 `migrateLocalDataToCloud()` 将任务 / 会话 / 日期一次性上传（客户端 ID 作为主键，upsert 幂等），成功后清空本地副本
- 游客统计由 `client/src/lib/stats.ts` 在本地计算，登录用户由 `GET /api/sessions/stats` 服务端聚合

### 安全设计

- 缺少 `JWT_SECRET` 时：Worker 返回 503 拒绝服务；Express 在 `NODE_ENV=production` 下启动即抛错；开发模式使用每次启动随机生成的临时密钥（仓库中不存在任何硬编码回退密钥）
- OAuth `state` 通过 httpOnly Cookie 绑定发起授权的浏览器，攻击者无法把受害者静默登录到自己的账号（否则可借首登迁移窃取受害者本地数据）
- SQL 全部参数化；动态 UPDATE 语句只拼接白名单列名
- 资源 ID 校验 `^[A-Za-z0-9_.-]{1,64}$`；所有读写语句强制 `WHERE ... AND user_id = ?`；upsert 的 DO UPDATE 分支带 `WHERE <table>.user_id = excluded.user_id`，用他人 id 提交写入被拒绝
- 输入限制：任务标题 500 字符、日期标题 200 字符、会话时长 0-24h、类型枚举
- 统计 SQL 只用 `substr` 等跨方言函数，保证 SQLite/D1/PostgreSQL 行为一致
- 已知边界：令牌存 localStorage（XSS 风险面）、有效期 7 天无撤销机制、无服务端频率限制；多用户公开部署前建议补 WAF / rate limiting

## 前端（client/）

| 项 | 说明 |
|----|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 3 + shadcn/ui 组件 |
| 入口 | `index.html` → `client/src/index.tsx` |

```
client/src/
├── App.tsx                  # 根组件（AuthProvider 包裹）：视图切换、导航、全局错误
├── components/              # FlipClock、TaskList、CountdownPage、AuthButton、ui/*
├── contexts/
│   ├── AuthContext.tsx      # 登录态、OAuth 回跳令牌接收、首登迁移
│   ├── I18nContext.tsx      # 多语言（zh / en / ru），值均 memoize
│   └── ThemeContext.tsx     # 深浅主题，localStorage 持久化
├── hooks/useTimerState.ts   # 计时状态机；会话结束经 store 落盘
├── lib/stats.ts             # 游客模式本地统计
├── services/
│   ├── apiService.ts        # HTTP 封装：自动附带 Bearer、统一 ApiError
│   └── store.ts             # 双模式数据层（云端 / localStorage）
└── types.ts                 # 共享类型
```

设计要点：

- **视图划分**：首页 / 专注（番茄、倒计时、待办子标签）/ 重要日期 / 统计 / 设置，状态驱动，无路由库。
- **设计令牌**：颜色统一走 `--gh-*` CSS 变量（`client/index.css`），无渐变、无 hover 特效。
- **计时精度**：倒计时基于绝对开始时间而非纯递减，减少后台标签页漂移。
- **乐观更新**：任务 / 日期变更先更新 UI，再异步经 `store` 同步，失败回滚重拉。

## 后端核心（api/core/）

| 文件 | 职责 |
|------|------|
| `handler.ts` | 路由分发、鉴权、任务 / 会话 / 日期 / 统计业务 |
| `jwt.ts` | HS256 签发校验、OAuth state 签发校验（Web Crypto） |
| `github.ts` | 授权 URL、code 换 token、读取用户资料（fetch） |
| `stats.ts` | 连续天数、近 7 天填充等纯函数（本地时区 YYYY-MM-DD） |
| `schema.ts` | 带方言的有序迁移：`MIGRATIONS` 列表 + `applyMigrations(db, dialect)`，已应用记录存 `schema_migrations` 表；新增字段 = 追加一条迁移 |
| `types.ts` | `CoreEnv` / `DbAdapter` / 行类型 |

适配层：

- `api/cloudflare/index.ts`：D1 -> `DbAdapter`；`/api` 前缀进核心，其余透传 ASSETS；首请求懒执行 `applyMigrations(db, 'sqlite')`；无 `JWT_SECRET` 时 503。
- `server/src/index.ts`：Express 请求转 Web `Request` 交给同一 `handleApi`；`express.text` 保证原样转发 body；启动时加载 `server/.env`、按 `DB_CLIENT` 选择驱动并执行迁移；密钥缺失时生产拒绝启动、开发用随机临时密钥。
- `server/src/database.ts`：驱动工厂（SQLite / PostgreSQL），PostgreSQL 侧把 `?` 占位符重写为 `$n`。

## API 端点

除 `/api/health` 与 `/api/auth/*` 外全部要求 `Authorization: Bearer <JWT>`，否则 401。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/github` | 302 跳 GitHub（未配置凭据返回 501） |
| GET | `/api/auth/github/callback` | 换 token，302 到 `/auth-done#token=` |
| GET | `/api/auth/me` | 当前用户 |

### 任务 `/api/tasks`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 当前用户任务列表 |
| POST | `/` | upsert（客户端可指定 `id`；`ON CONFLICT(id) DO UPDATE`） |
| PUT | `/:id` | 更新 |
| DELETE | `/:id` | 删除 |

### 会话 `/api/sessions`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 会话列表 |
| POST | `/` | 记录会话（客户端 `id` 幂等，`ON CONFLICT DO NOTHING`） |
| PUT | `/:id` / DELETE `/:id` | 更新 / 删除 |
| GET | `/stats` | 今日专注 / 周合计 / 周数据 / 热力图 / streak（`{current,max,totalDays}`，均为当前用户数据） |

### 重要日期 `/api/countdowns`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 列表（按目标日期升序） |
| POST | `/` | upsert（`targetDate` 必须为合法日期串） |
| PUT | `/:id` / DELETE `/:id` | 更新 / 删除 |

## 数据模型

所有业务表含 `user_id`（游客模式不写库）。表结构以 `api/core/schema.ts` 的 `MIGRATIONS` 为唯一来源，由 `applyMigrations` 在启动时按 `schema_migrations` 记账表增量执行；`api/cloudflare/schema.sql` 仅用于全新 D1 一次性初始化（内容与迁移保持一致）。

### users

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | GitHub 用户 ID（字符串化） |
| login | TEXT | GitHub 用户名 |
| avatar_url | TEXT | 头像地址 |
| created_at / updated_at | TEXT | ISO 时间戳 |

### tasks

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 客户端生成（`task_` 前缀） |
| user_id | TEXT | 所属用户 |
| title / description | TEXT | 标题（<=500）/ 描述（<=2000） |
| is_completed | INTEGER | 0/1 |
| order_index | INTEGER | 排序 |
| created_at / updated_at | TEXT | ISO 时间戳 |

### sessions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 客户端生成，幂等键 |
| user_id | TEXT | 所属用户 |
| type | TEXT | work / break / longBreak（CHECK 约束） |
| duration | INTEGER | 计划秒数 |
| start_time / end_time | TEXT | 起止时间 |
| is_completed | INTEGER | 0/1 |
| work_time | INTEGER | 实际专注秒数 |
| created_at / updated_at | TEXT | ISO 时间戳 |

### countdowns

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 客户端生成（`cd_` 前缀） |
| user_id | TEXT | 所属用户 |
| title | TEXT | 事件名（<=200） |
| target_date | TEXT | 目标日期时间串 |
| created_at / updated_at | TEXT | ISO 时间戳 |

索引：`tasks/sessions/countdowns` 均有 `user_id` 索引；会话另有 `created_at` / `type` / `start_time` 索引。

历史遗留数据（重构前无 `user_id` 的行）迁移后 `user_id = ''`，不归属任何登录用户，任何接口均不可见。

### schema_migrations

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 迁移标识，如 `0001_init` |
| applied_at | TEXT | ISO 时间戳 |

### 如何给数据表加字段

1. 在 `api/core/schema.ts` 的 `MIGRATIONS` 末尾追加一条迁移（id 递增编号，如 `0003_add_task_priority`），为 `sqlite` 与 `postgres` 两个方言分别给出 `ALTER TABLE ... ADD COLUMN` 语句（PostgreSQL 可用 `IF NOT EXISTS` 保持幂等）。
2. 在 `api/core/handler.ts` 相应读写路径中使用新列（列名变更需同步更新白名单与 `map*` 函数，前端 `client/src/types.ts` 的 API 类型同步）。
3. 全新 D1 初始化用的 `api/cloudflare/schema.sql` 同步补充列，并把新迁移 id 追加到文件末尾的 `INSERT OR IGNORE INTO schema_migrations`。
4. 运行 `npm run validate`；已有部署的 SQLite / PostgreSQL 库在服务重启时自动完成升级，无需手工迁移。

不要修改或删除已经发布过的迁移语句——它们已在其他环境的数据库上执行过。
