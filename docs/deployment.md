# 部署指南

本文档介绍如何将 Orbit Focus 部署到 Cloudflare Workers（推荐方式），以及 Vercel 备选方案。

## Cloudflare Workers 部署

### 前置要求

- Node.js 20+
- Cloudflare 账号
- wrangler CLI：`npm install -g wrangler`
- 已登录 Cloudflare：`wrangler login`

### 方式一：一键脚本（推荐）

```bash
npm run setup
```

脚本（`setup-cloudflare.sh`）会自动完成：

1. 检查 wrangler 安装与登录状态
2. 创建 D1 数据库（如 `wrangler.toml` 中尚无 `database_id`）
3. 将 `database_id` 写回 `wrangler.toml`
4. 初始化远程数据库 schema
5. 构建并部署 Worker

### 方式二：手动分步执行

```bash
# 1. 创建 D1 数据库（首次）
wrangler d1 create orbit-focus-db
# 将输出中的 database_id 填入 wrangler.toml 的 d1_databases 段

# 2. 初始化远程数据库表结构
npm run cf:db:init

# 3. 构建并部署
npm run cf:deploy
```

部署完成后 Worker 名称为 `orbit-focus`，静态资源与 API 同域提供服务。

### GitHub Actions 自动部署

仓库已配置 `.github/workflows/deploy.yml`：

- 触发条件：push 到 `main` 分支，或手动触发（workflow_dispatch）
- 流程：checkout → Node 20 → `npm install` → `npm run build` → `cloudflare/wrangler-action@v3` 部署

需要在仓库 Settings → Secrets and variables → Actions 中配置：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token，需具备 Workers 部署与 D1 权限 |

推送后可在仓库 Actions 页查看部署进度；线上版本通常在一分钟内更新。

## 本地 Workers 预览

在提交部署前，可用 wrangler 在本地以 Workers 运行时验证：

```bash
npm run cf:db:init:local   # 初始化本地 D1 模拟器
npm run cf:dev             # 启动本地 Workers，访问 http://localhost:8787
npm run cf:tail            # 实时查看线上 Worker 日志
```

## Vercel 部署（备选）

`api/vercel/` 目录提供了同一套 API 的 Vercel Serverless 实现（数据库为 SQLite）。Vercel 为无状态 Serverless，SQLite 文件不持久化，仅适合体验部署，生产建议使用 Cloudflare D1 版本。

## 配置参考（wrangler.toml）

| 配置 | 值 | 说明 |
|------|-----|------|
| `name` | orbit-focus | Worker 名称 |
| `main` | api/cloudflare/index.ts | Workers 入口 |
| `[assets] directory` | dist | 前端构建产物目录 |
| `[assets] not_found_handling` | single-page-application | SPA 路由回退 |
| `[[d1_databases]] binding` | orbit_focus_db | D1 绑定名，代码中通过环境变量访问 |
| `[dev] port` | 8787 | wrangler dev 本地端口 |

## 常见问题

**部署后 API 报错（表不存在）**：远程 D1 未初始化，执行 `npm run cf:db:init`。

**Actions 部署失败（鉴权错误）**：检查 `CLOUDFLARE_API_TOKEN` 是否有效、权限模板是否包含 Workers Scripts:Edit 与 D1:Edit。

**静态资源 404**：确认部署前已执行 `npm run build` 生成 `dist/`（`cf:deploy` 脚本已内置构建步骤）。
