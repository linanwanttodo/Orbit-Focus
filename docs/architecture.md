# 架构说明

本文档描述 Orbit Focus 的整体架构、前后端设计与数据模型。

## 总体结构

```
浏览器（React SPA）
    |
    |  REST /api/*
    v
后端（两套可互换实现，同一套 API 契约）
    ├── 本地开发：Express + better-sqlite3（server/，端口 3000）
    └── 线上部署：Cloudflare Workers + D1（api/cloudflare/）
```

前端是纯静态 SPA，构建产物为 `dist/`。本地开发时由 Vite 托管并代理 API；线上由 Cloudflare Workers 托管静态资源（`[assets]` 绑定，SPA fallback）并在同一 Worker 内处理 API 请求。

## 前端（client/）

| 项 | 说明 |
|----|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 3 + shadcn/ui 组件 |
| 入口 | `index.html` → `client/src/index.tsx` |

关键目录：

```
client/src/
├── App.tsx                 # 根组件：视图路由、导航栏、全局底栏
├── components/             # UI 组件（FlipClock、Footer、ui/ 为 shadcn 基件）
├── contexts/
│   ├── I18nContext.tsx     # 多语言（zh / en / ru），语言包在 locales/*.json
│   └── ThemeContext.tsx    # 深色 / 浅色主题，持久化到 localStorage
├── hooks/
│   └── useTimerState.ts    # 全局计时状态：倒计时、视图、任务、样式、音频提示
├── services/
│   └── apiService.ts       # 封装所有 /api 请求
└── types.ts                # 共享类型定义
```

设计要点：

- **视图划分**：首页（Home）、计时（专注 / 倒计时 / 待办三个子标签）、统计、设置，由顶部导航的 Tabs 切换，无路由库，状态驱动。
- **设计令牌**：颜色统一走 `--gh-*` CSS 变量（`client/index.css`），shadcn/ui 的语义变量桥接到同一套令牌，深浅主题各自取值。
- **应用壳布局**：根容器固定 `100dvh`，导航栏 fixed 顶部、版权底栏 fixed 底部，窗口级滚动禁用（`html, body { overflow: hidden }`），页面内滚动均发生在内部容器。
- **计时精度**：倒计时基于绝对时间（`countdownStartTime`）而非纯递减，减少后台标签页计时漂移。

## 后端

### 本地版（server/）

```
server/src/
├── index.ts        # Express 应用入口，挂载路由与静态文件
├── database.ts     # SQLite 初始化与建表（data/ 目录）
├── routes/         # tasks.ts、sessions.ts 路由定义
├── controllers/    # 请求处理
├── services/       # 业务逻辑
├── models/         # 数据访问
└── utils/
```

### Cloudflare Workers 版（api/cloudflare/）

同一套 REST 契约的 Workers 实现，数据存 D1（`orbit_focus_db`）。`wrangler.toml` 中配置资产目录（`dist`）、SPA fallback 与 D1 绑定。另有 `api/vercel/` 提供部署到 Vercel Serverless 的备选实现。

## API 端点

### 任务管理 `/api/tasks`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 获取全部任务 |
| POST | `/` | 创建任务 |
| PUT | `/:id` | 更新任务 |
| DELETE | `/:id` | 删除任务 |

### 会话管理 `/api/sessions`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 获取全部专注会话 |
| POST | `/` | 记录一次专注会话（时长 + 开始时间） |
| PUT | `/:id` | 更新会话 |
| DELETE | `/:id` | 删除会话 |
| GET | `/stats` | 聚合统计（今日专注、周合计、连续天数、热力图数据） |

## 数据模型

### tasks

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 任务 ID |
| title | TEXT | 标题 |
| description | TEXT | 描述，默认空 |
| is_completed | INTEGER | 是否完成，0/1 |
| order_index | INTEGER | 排序序号 |
| created_at / updated_at | TEXT | ISO 时间戳 |

### sessions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | 会话 ID |
| type | TEXT | 类型：work / break / longBreak |
| duration | INTEGER | 计划时长 |
| start_time | TEXT | 开始时间 |
| end_time | TEXT | 结束时间 |
| is_completed | INTEGER | 是否完成 |
| work_time | INTEGER | 实际专注时长 |
| created_at / updated_at | TEXT | ISO 时间戳 |

D1 版建表语句见 `api/cloudflare/schema.sql`，本地版见 `server/src/database.ts`，两者字段一致。
