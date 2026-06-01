# Orbit Focus - Cloudflare 部署指南

本文档详细说明如何将 Orbit Focus 部署到 Cloudflare Workers + D1 数据库，包括自动化 CI/CD 配置。

## 架构概览

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   GitHub    │────▶│ Cloudflare       │────▶│ Cloudflare  │
│   Actions   │     │ Workers          │     │ D1 Database │
│  (CI/CD)    │     │ (API + Static)   │     │ (SQLite)    │
└─────────────┘     └──────────────────┘     └─────────────┘
```

- **Cloudflare Workers**: 运行 API 服务 (TypeScript)
- **Cloudflare Assets**: 托管前端静态文件 (React + Vite)
- **Cloudflare D1**: SQLite 兼容的云数据库

---

## 前置条件

1. **Node.js** >= 18
2. **Cloudflare 账户** (免费计划即可)
3. **GitHub 账户** (用于代码托管和自动部署)

---

## 方式一：自动部署（推荐）

### 第 1 步：获取 Cloudflare 凭证

#### 1.1 获取 Account ID

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择任意一个域名（或点击右侧边栏）
3. 在 **API** 部分找到 **Account ID**
4. 复制保存

#### 1.2 创建 API Token

1. 访问 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 **Create Token**
3. 选择 **Edit Cloudflare Workers** 模板
4. 点击 **Continue to summary**
5. 确认权限后点击 **Create Token**
6. **立即复制并保存 Token**（只会显示一次）

### 第 2 步：配置 GitHub Secrets

1. 打开你的 GitHub 仓库页面
2. 进入 **Settings** → **Secrets and variables** → **Actions**
3. 点击 **New repository secret**，依次添加：

| Secret 名称 | 值 | 说明 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | 上一步创建的 Token | Cloudflare API 访问凭证 |
| `CLOUDFLARE_ACCOUNT_ID` | 你的 Account ID | Cloudflare 账户标识 |

### 第 3 步：首次本地部署（初始化数据库）

```bash
# 1. 克隆仓库
git clone <your-repo-url>
cd orbit-focus

# 2. 安装依赖
npm install

# 3. 安装 Wrangler CLI（如果没有）
npm install -g wrangler

# 4. 登录 Cloudflare
wrangler login

# 5. 运行一键部署脚本
npm run setup
```

`npm run setup` 会自动执行以下操作：
- ✅ 检查 Cloudflare 登录状态
- ✅ 创建 D1 数据库
- ✅ 将 database_id 写入 `wrangler.toml`
- ✅ 初始化数据库表结构
- ✅ 构建前端
- ✅ 部署 Worker

部署成功后，你会看到类似输出：

```
🎉 部署成功！
======================================
📌 Worker URL: https://orbit-focus.<your-subdomain>.workers.dev
📌 数据库 ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 第 4 步：推送代码触发自动部署

```bash
# 将更新后的 wrangler.toml（含 database_id）推送到 GitHub
git add wrangler.toml
git commit -m "chore: configure D1 database for Cloudflare deployment"
git push origin main
```

推送后，GitHub Actions 会自动：
1. 安装依赖
2. 构建前端
3. 部署 Worker 到 Cloudflare
4. 初始化/更新数据库 schema

你可以在 GitHub 仓库的 **Actions** 标签页查看部署进度。

---

## 方式二：手动部署

如果你想完全手动控制每一步：

```bash
# 1. 登录 Cloudflare
wrangler login

# 2. 创建 D1 数据库（首次）
wrangler d1 create orbit-focus-db
# 记录输出中的 database_id，手动填入 wrangler.toml

# 3. 初始化数据库 schema
wrangler d1 execute orbit-focus-db --remote --file=./api/cloudflare/schema.sql

# 4. 构建前端
npm run build:client

# 5. 部署 Worker
wrangler deploy
```

---

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run setup` | 一键初始化 + 部署（首次使用） |
| `npm run cf:deploy` | 构建前端 + 部署 Worker |
| `npm run cf:dev` | 本地开发（使用 Cloudflare 模拟器） |
| `npm run cf:db:init` | 远程初始化/更新数据库 schema |
| `npm run cf:db:init:local` | 本地初始化数据库（用于 cf:dev） |
| `npm run cf:tail` | 查看 Worker 实时日志 |

---

## 配置自定义域名

### 方式 A：Workers 路由

```bash
# 1. 在 Cloudflare Dashboard 中添加你的域名
# 2. 创建路由
wrangler route create "orbit-focus.example.com/*" orbit-focus
```

### 方式 B：自定义域名（推荐）

```bash
# 为 Worker 添加自定义域名
wrangler custom-domains add orbit-focus.example.com
```

---

## 数据库管理

### 查看数据库列表

```bash
wrangler d1 list
```

### 查询数据

```bash
wrangler d1 execute orbit-focus-db --remote --command "SELECT * FROM sessions LIMIT 10"
```

### 备份数据库

```bash
wrangler d1 export orbit-focus-db --output backup.sql
```

### 重置数据库

```bash
# 删除旧表
wrangler d1 execute orbit-focus-db --remote --command "DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS tasks;"

# 重新初始化
wrangler d1 execute orbit-focus-db --remote --file=./api/cloudflare/schema.sql
```

---

## 故障排除

### 问题：部署后 API 返回 404

**原因**：`wrangler.toml` 中的 `database_id` 未正确配置

**解决**：
```bash
# 检查 database_id 是否已设置
grep database_id wrangler.toml

# 如果显示 YOUR_DATABASE_ID_HERE，运行：
npm run setup
```

### 问题：GitHub Actions 部署失败

**原因**：Secrets 未配置或 Token 权限不足

**解决**：
1. 检查 Settings → Secrets 中是否正确添加了 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`
2. 确认 API Token 具有 `Edit Cloudflare Workers` 权限
3. 确认 Account ID 正确

### 问题：数据库表不存在

**解决**：
```bash
npm run cf:db:init
```

### 问题：本地开发时 API 不可用

**解决**：
```bash
# 先初始化本地数据库
npm run cf:db:init:local

# 再启动本地开发
npm run cf:dev
```

---

## 环境变量

在 `wrangler.toml` 中配置：

```toml
[vars]
NODE_ENV = "production"
```

如需添加更多环境变量，可在 Cloudflare Dashboard → Workers → Settings → Variables 中配置加密变量。

---

## 免费计划限制

Cloudflare Workers 免费计划包括：

| 资源 | 免费额度 |
|---|---|
| Worker 请求 | 100,000 次/天 |
| CPU 时间 | 10ms/请求 |
| D1 读取 | 500 万次/天 |
| D1 写入 | 100,000 次/天 |
| D1 存储 | 5 GB |

对于个人使用完全足够。
