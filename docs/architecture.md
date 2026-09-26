# 架构说明

## 总体结构

```text
浏览器 React SPA
    |
    | REST /api/*，登录后 Authorization: Bearer <JWT>
    v
api/core/handler.ts（平台无关业务核心）
    ├── Cloudflare Workers + D1：api/cloudflare/index.ts
    └── Express + SQLite/PostgreSQL：server/src/index.ts
            └── server/src/database.ts（DbAdapter 驱动工厂）
```

前端由 Vite 构建并由两种后端适配方式提供：

- Cloudflare Worker 通过 `[assets]` 托管 `dist/`
- Express 通过 `express.static` 托管 `dist/`

## 数据模式

### 游客模式

未登录时数据只保存在浏览器版本化 localStorage 中，不发送 API 请求。应用首次使用新版本时会清理旧格式的 Orbit Focus 数据。

### 登录模式

登录后使用 GitHub OAuth：

1. 浏览器跳转 `/api/auth/github`
2. 服务端生成签名 state，并写入 HttpOnly Cookie
3. GitHub 回调校验 state、Cookie 和授权码
4. 服务端签发 7 天有效的 HS256 JWT
5. 前端从 `/auth-done#token=...` 接收令牌并保存
6. 任务、未来日期和专注记录通过 `user_id` 隔离

## 全新数据库基线

当前版本不保留旧数据库和旧游客数据，因此没有历史迁移表。`api/core/schema.ts` 的 `initializeSchema()` 执行最新的幂等建表语句，`api/cloudflare/schema.sql` 是同一结构的 D1 初始化脚本。

### users

```text
id, login, avatar_url, created_at, updated_at
```

### tasks

```text
(user_id, id)       复合主键
title               1-500 字符
description         最多 2000 字符
status              todo / progress / review / done
priority            high / medium / low
due_date            YYYY-MM-DD，可为空
order_index         排序
created_at, updated_at
```

简单清单和任务看板使用同一张任务表。简单清单的完成状态对应 `status = done`。

### sessions

```text
(user_id, id)       复合主键
type                work / break / longBreak
duration            计划秒数
work_time           实际记录秒数
start_time, end_time
local_date          浏览器本地自然日 YYYY-MM-DD
timezone            浏览器 IANA 时区
is_completed
created_at, updated_at
```

统计以 `local_date` 为准，而不是以 Cloudflare/Docker 服务器时区或 UTC 日期为准。

### countdowns

“未来”页面使用独立的目标日期表，按 `(user_id, id)` 隔离。

### 初始化时机

- Express 启动时执行一次
- Cloudflare Worker 首次 API 请求时执行一次
- 进程重启会安全地重复执行 `CREATE ... IF NOT EXISTS`
- 旧数据库不会被自动升级；需要删除并按新 schema 重新创建

## API

除健康检查和认证入口外，接口都要求 Bearer JWT。

- `GET /api/health`
- `GET /api/auth/github`
- `GET /api/auth/github/callback`
- `GET /api/auth/me`
- `GET/POST/PUT/DELETE /api/tasks`
- `GET/POST/PUT/DELETE /api/sessions`
- `GET /api/sessions/stats?today=YYYY-MM-DD`
- `GET/POST/PUT/DELETE /api/countdowns`

所有 SQL 使用参数化查询。动态更新字段使用固定白名单，所有业务读写都带 `user_id` 条件。

## 计时器

计时器使用绝对 `deadline`：

- 每次 tick 根据 `Date.now()` 计算剩余秒数
- 活动状态和 deadline 保存到 localStorage
- 页面刷新后恢复运行或暂停状态
- 只有自然完成才写入一个 session
- 暂停、继续和重置不写入 session
- session 使用完成时浏览器的本地日期和时区

## 前端视图

顶部导航：

```text
首页 | 专注 | 统计 | 设置
```

专注页二级导航：

```text
时间 | 倒计时 | 未来 | 待办
```

- `倒计时`是计时器中的自定义倒计时
- `未来`是原有重要日期/目标日提醒
- `待办`默认显示四列任务看板
- 设置中的“待办视图”可以在任务看板和简单清单之间切换

任务看板列：待办、进行中、审阅中、已完成。看板支持新建、编辑、删除、优先级、与原待办页面一致的主题化原生日期输入框、状态选择和拖拽改状态。任务卡片只显示日历图标，颜色跟随当前主题的前景色。

手机和平板进入“时间”页时，会优先尝试请求系统横屏锁定；不支持时监听 `deviceorientation`，按设备倾斜方向旋转时钟内容，离开时间/倒计时页时释放横屏锁定。桌面端保持原有横向布局。

## Docker

Docker 私有化部署使用同一个 API 核心：

```text
前端 dist/ + Express + SQLite（默认）
```

也可以通过 `DB_CLIENT=postgres` 使用 PostgreSQL。详见 [Docker 私有化部署](docker-deployment.md)。

## Cloudflare

Cloudflare 继续使用 Worker + D1。由于本次是全新数据库基线，部署前应删除旧的空 D1 数据库并重新创建，再执行新的 `schema.sql`。Worker secrets 使用 `wrangler secret put` 设置，不写入 `wrangler.toml`。

## 安全边界

- 缺少 `JWT_SECRET` 时 Worker 返回 503，生产 Express 拒绝启动
- OAuth state 与 HttpOnly Cookie 绑定
- 任务、会话和未来日期均按 `user_id` 隔离
- ID、枚举、日期和长度在 API 层校验
- JWT 当前保存在 localStorage，已知 XSS 风险面
- 当前没有令牌撤销机制和服务端频率限制，公网部署应在反向代理或 Cloudflare 层增加防护
