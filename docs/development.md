# 本地开发指南

本文档介绍如何在本地搭建和运行 Orbit Focus 的开发环境。

## 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | 20.x | 前端构建与后端运行 |
| npm | 10.x | 随 Node.js 附带 |
| SQLite | 无需单独安装 | 本地开发通过 better-sqlite3 内嵌运行 |

可选：Cloudflare 账号 + wrangler CLI（仅在需要调试 Workers 版后端时使用）。

## 安装依赖

```bash
git clone https://github.com/linanwanttodo/Orbit-Focus.git
cd Orbit-Focus
npm install
```

## 启动开发环境

### 一键启动（推荐）

```bash
npm run dev
```

该命令会同时启动两个进程：

| 进程 | 端口 | 说明 |
|------|------|------|
| client | 5173 | Vite 开发服务器，访问 http://localhost:5173 |
| server | 3000 | Express API，前端通过 Vite 代理 `/api` 访问 |

前端开发服务器已配置代理：所有 `/api/*` 请求自动转发到 `http://localhost:3000`，无需处理跨域。

### 分离启动

```bash
npm run dev:client   # 只启动前端
npm run dev:server   # 只启动后端（tsx watch，文件变更自动重启）
```

## 数据库

本地开发使用 SQLite（better-sqlite3），首次启动时自动建表，数据库文件位于 `data/` 目录（已加入 .gitignore）。

数据表结构见 `server/src/database.ts`，与 Cloudflare D1 版本共享同一套字段定义（见 `api/cloudflare/schema.sql`）。

## 代码校验

```bash
npm run validate:client   # TypeScript 类型检查 + ESLint（client/src）
npm run lint              # ESLint 全仓库
npm run lint:fix          # ESLint 自动修复
```

提交前建议确保 `validate:client` 无错误（0 errors；仓库现存 10 条 warning 为历史遗留，可忽略）。

## 构建生产版本

```bash
npm run build          # 前端构建（vite build）+ 后端编译（tsc）
npm run build:client   # 只构建前端，产物在 dist/
npm run build:server   # 只编译后端 TypeScript
```

## 调试 Workers 版后端（可选）

如需在本地以 Cloudflare Workers 运行时调试后端：

```bash
npm run cf:db:init:local   # 初始化本地 D1（模拟器）
npm run cf:dev             # 启动 wrangler dev，访问 http://localhost:8787
```

## 常见问题

**端口被占用**：Vite 固定使用 5173（`vite.config.ts` 中配置），Express 固定使用 3000。若端口冲突，先释放对应端口或临时修改配置。

**文件变更不触发热更新**：项目启用了轮询监听（`usePolling`），因部分 Linux 系统 inotify 上限过低会导致 ENOSPC 错误，轮询模式可规避。

**API 请求 404**：确认后端进程（3000 端口）已启动；Vite 代理只在开发模式生效。
