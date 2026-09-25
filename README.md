# Orbit Focus - 全栈番茄钟与任务看板

Orbit Focus 是一个 React + TypeScript 全栈生产力应用，包含番茄钟/倒计时、未来日期提醒、任务看板、统计和 GitHub 登录。

数据支持两种模式：

- 游客模式：数据只保存在浏览器本地
- 登录模式：数据保存到 Cloudflare D1 或 Docker 使用的 SQLite/PostgreSQL

## 技术栈

### 前端

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- 深浅主题
- 中文、英文、俄文
- 数字时钟和翻页时钟

### 后端

- 平台无关 API 核心：`api/core/`
- Cloudflare Workers + D1
- Express + SQLite/PostgreSQL
- GitHub OAuth + HS256 JWT
- 用户级数据隔离

## 页面结构

顶部导航：

```text
首页 | 专注 | 统计 | 设置
```

专注页二级导航：

```text
时间 | 倒计时 | 未来 | 待办
```

- `倒计时`是计时器里的自定义倒计时
- `未来`是重要日期和目标日提醒
- `待办`默认显示任务看板
- 设置中可以在“任务看板”和“简单清单”之间切换

## 功能

- 数字时钟 / 翻页时钟，手机和平板支持系统横屏 + 陀螺仪 CSS 旋转回退
- 自定义倒计时，按绝对 deadline 计算
- 倒计时自然完成时自动记录一次专注
- 未来日期：考试、截止日、目标日
- 四列任务看板：待办、进行中、审阅中、已完成
- 任务优先级、截止日期、描述、拖拽改状态
- 今日专注、周总计、连续天数、年度热力图
- 统计按用户浏览器时区的自然日计算
- GitHub 登录和游客本地模式
- Cloudflare D1 部署
- Docker 私有化部署

## 本地开发

环境要求：Node.js 20+。

```bash
npm install
npm run dev
```

访问 `http://localhost:5173`。

不配置 GitHub OAuth 也可以使用游客模式。需要稳定登录态时，在 `server/.env` 设置 `JWT_SECRET`。

## 校验和测试

```bash
npm run validate
npm test
npm run build
```

## Cloudflare 部署

项目使用 `wrangler.toml` 中的 D1 binding `orbit_focus_db`。

因为当前数据库采用全新 schema、没有历史数据迁移，部署时推荐删除旧的空 D1 后重新创建：

```bash
npx wrangler d1 delete orbit_focus_db
npx wrangler d1 create orbit_focus_db
npx wrangler d1 execute orbit_focus_db --remote --file=./api/cloudflare/schema.sql
npx wrangler secret put JWT_SECRET
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npm run build
npx wrangler deploy
```

GitHub OAuth App 的回调地址：

```text
https://<worker-domain>/api/auth/github/callback
```

部署后检查：

```bash
curl https://<worker-domain>/api/health
```

详细步骤见 [部署指南](docs/deployment.md)。

## Docker 私有化部署

```bash
cp .env.docker.example .env
# 编辑 .env，至少设置 JWT_SECRET
docker compose up -d --build
curl http://127.0.0.1:3000/api/health
```

默认 SQLite 文件保存在宿主机 `./data/orbit-focus.db`，也可以在 `.env` 中切换 PostgreSQL。

详细步骤见 [Docker 私有化部署](docs/docker-deployment.md)。

## 文档

| 文档 | 内容 |
|---|---|
| [本地开发](docs/development.md) | 环境、启动、测试和调试 |
| [架构说明](docs/architecture.md) | 数据模型、认证、API、计时器和前端结构 |
| [部署指南](docs/deployment.md) | Cloudflare D1、Express 和数据库初始化 |
| [Docker 部署](docs/docker-deployment.md) | 私有化、OAuth、备份和运维 |

## 当前版本的数据说明

本版本不迁移旧数据库和旧 localStorage 数据。若从旧版本升级，请先备份，然后在测试环境删除旧数据库并按最新 schema 重新创建。

## 许可证

MIT
