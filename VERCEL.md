# Orbit Focus - Vercel 部署指南

本文档详细说明如何将 Orbit Focus 部署到 Vercel Edge Functions + Turso (libSQL)。

## 架构概览

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   GitHub    │────▶│ Vercel           │────▶│ Turso       │
│  (代码托管)  │     │  ├─ Edge Function│     │ (libSQL)    │
│             │     │  └─ Static (CDN) │     │             │
└─────────────┘     └──────────────────┘     └─────────────┘
```

- **Vercel Edge Function** (`api/vercel/index.ts`)：运行 API 服务 (TypeScript, Edge Runtime)
- **Vercel Static**：托管前端静态文件 (React + Vite)
- **Turso**：托管型 libSQL（SQLite 协议），边缘复制、全球低延迟

---

## 前置条件

1. **Node.js** >= 18
2. **Vercel 账户** (免费计划即可)
3. **Turso 账户** (免费计划即可)

---

## 第 1 步：创建 Turso 数据库

### 1.1 安装 Turso CLI

```bash
# macOS / Linux
curl -sSfL https://get.tur.so/install.sh | bash
```

### 1.2 登录并创建数据库

```bash
# 登录
turso auth login

# 创建数据库（选择离你近的区域）
turso db create orbit-focus-db --location closest

# 获取数据库 URL（形如 libsql://orbit-focus-db-xxx.turso.io）
turso db show orbit-focus-db --url

# 创建用于 Vercel 的长期访问 token
turso db tokens create orbit-focus-vercel
```

> ⚠️ **请立即保存 token 和 URL**，关闭终端后无法再次查看 token。

### 1.3 初始化数据库 schema

```bash
# 在项目根目录执行
turso db shell orbit-focus-db < api/cloudflare/schema.sql
```

> 该 schema 文件同时兼容 D1 和 libSQL，可直接复用。

---

## 第 2 步：本地环境变量

在项目根目录创建 `.env.local`（该文件已在 `.gitignore` 中）：

```bash
TURSO_DATABASE_URL=libsql://orbit-focus-db-xxx.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

> Vercel Edge Runtime 使用 `process.env.TURSO_*` 读取变量，参见 `api/vercel/database.ts:10-11`。

---

## 第 3 步：配置 Vercel 项目

### 方式 A：通过 Vercel Dashboard（推荐）

1. 访问 https://vercel.com/new
2. 导入你的 GitHub 仓库
3. **Environment Variables** 区域添加：
   - `TURSO_DATABASE_URL` → 填入第 1.2 步的 URL
   - `TURSO_AUTH_TOKEN` → 填入第 1.2 步的 token
4. **Build & Development Settings** 一般无需修改，Vercel 会自动识别 `vercel.json`
5. 点击 **Deploy**

### 方式 B：通过 Vercel CLI

```bash
# 安装并登录
npm install -g vercel
vercel login

# 首次部署（会引导创建项目）
vercel

# 部署到生产环境
vercel --prod

# 添加环境变量
vercel env add TURSO_DATABASE_URL production
# 粘贴 URL，回车

vercel env add TURSO_AUTH_TOKEN production
# 粘贴 token，回车
```

---

## 第 4 步：验证部署

部署成功后访问 Vercel 提供的域名（例如 `https://orbit-focus.vercel.app`）：

```bash
# 健康检查
curl https://orbit-focus.vercel.app/api/health
# 期望: {"status":"ok","timestamp":"...","platform":"vercel"}

# 测试任务 API
curl https://orbit-focus.vercel.app/api/tasks
# 期望: [] 或已创建的 tasks
```

---

## 常用命令

| 命令 | 说明 |
|---|---|
| `vercel` | 部署到预览环境 |
| `vercel --prod` | 部署到生产环境 |
| `vercel env ls` | 查看已配置的环境变量 |
| `vercel logs` | 实时查看生产环境日志 |
| `vercel rm <deployment>` | 删除某个部署 |
| `turso db show orbit-focus-db` | 查看 Turso 数据库信息 |
| `turso db shell orbit-focus-db` | 进入 Turso 交互式 shell |

---

## 与 Cloudflare 部署的差异

| 维度 | Cloudflare | Vercel + Turso |
|---|---|---|
| API 运行时 | Workers (V8 isolate) | Edge Functions (V8 isolate) |
| 数据库 | D1 (SQLite) | Turso (libSQL) |
| 冷启动 | ~5ms | ~50-100ms |
| 边缘复制 | 内置 (D1 read replica) | 内置 (Turso replicas) |
| 免费额度 | 10万请求/天 | 100万 Edge 请求/月 + 5GB Turso 存储 |
| 国内访问 | 较慢 | 较慢 |

> 两个平台共用同一份前端代码（`client/`），仅 API 入口不同。生产环境建议**只选其一**，避免数据分裂。

---

## 故障排除

### 问题：Edge Function 返回 500 "Cannot find module '@libsql/client'"

**原因**：`api/vercel/package.json` 缺失或依赖未安装。

**解决**：
```bash
cd api/vercel
npm install
git add api/vercel/package.json api/vercel/package-lock.json
git commit -m "chore: add @libsql/client for Vercel Edge Function"
```

### 问题：刷新页面报 404

**原因**：`vercel.json` 缺少 SPA fallback rewrite（已在新版默认配置中包含）。

**解决**：确保 `vercel.json` 包含以下 rewrite：
```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/vercel/index" },
    { "source": "/((?!api|_next|.*\\..*).*)", "destination": "/index.html" }
  ]
}
```

### 问题：API 一直返回 "fetch failed" 或连接超时

**原因**：Turso 区域选择不当或 token 过期。

**解决**：
```bash
# 测试连通性
curl -H "Authorization: Bearer $TURSO_AUTH_TOKEN" $TURSO_DATABASE_URL/v1/health

# 重建 token
turso db tokens rotate orbit-focus-db
# 把新 token 更新到 Vercel
vercel env rm TURSO_AUTH_TOKEN production
vercel env add TURSO_AUTH_TOKEN production
```

### 问题：本地 `vercel dev` 起不来

**原因**：当前工作目录含中文/空格，Vercel CLI 无法解析项目名。

**解决**：把项目移到纯英文路径：
```bash
mv "~/桌面/Orbit-Focus" "~/projects/orbit-focus"
```

---

## 自定义域名

1. 在 Vercel Dashboard → Project → **Settings** → **Domains**
2. 添加你的域名，按提示在 DNS 提供商处添加 CNAME 记录
3. Vercel 会自动签发 SSL 证书

---

## 监控与日志

- **Vercel Dashboard**：实时函数日志、构建日志、性能指标
- **Turso Dashboard**：查询性能、慢查询、连接数
- **推荐接入**：Vercel Analytics（免费，1 行代码）

---

## 下一步

- 部署完成后建议接入 Vercel Analytics 观察真实流量
- 长期可考虑用 GitHub Actions 实现 Turso schema 变更的自动化
- 监控 D1 / Turso 用量，临近免费额度上限时及时升级或迁移
