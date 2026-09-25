# Docker 私有化部署

Orbit Focus 可以使用单个 Docker 容器私有化运行。容器同时提供：

- Vite 构建后的前端静态资源
- Express API
- 默认 SQLite 数据库
- 可选 PostgreSQL 数据库

游客模式不需要登录，也不会向服务器发送数据。启用 GitHub 登录后，任务、未来日期和专注记录会保存到容器连接的数据库。

## 1. 环境要求

- Docker Engine 24+
- Docker Compose v2
- Node.js 20+（只在不使用 Docker 构建时需要）
- 一个域名和 HTTPS 反向代理（启用 GitHub 登录时需要）

## 2. 快速开始

```bash
cp .env.docker.example .env
```

编辑 `.env`，至少设置一个随机 JWT 密钥：

```bash
openssl rand -hex 32
```

启动：

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
curl http://127.0.0.1:3000/api/health
```

正常响应类似：

```json
{"status":"ok","timestamp":"..."}
```

停止服务：

```bash
docker compose down
```

## 3. 数据持久化和备份

默认 SQLite 文件位于：

```text
./data/orbit-focus.db
```

`./data` 会挂载到容器的 `/app/data`，因此重新构建或重启容器不会删除数据。

备份：

```bash
docker compose stop
cp data/orbit-focus.db "backups/orbit-focus-$(date +%F).db"
docker compose start
```

也可以在容器运行时使用 SQLite 的一致性备份方式：

```bash
docker compose exec orbit-focus node -e "const Database=require('better-sqlite3'); const db=new Database('/app/data/orbit-focus.db'); db.backup('/app/data/orbit-focus.backup.db').then(() => db.close())"
```

将 `data/` 目录定期备份到 NAS、对象存储或另一台服务器。

## 4. GitHub 登录

### 4.1 创建 GitHub OAuth App

在 GitHub 的 Developer settings → OAuth Apps 创建应用：

- Homepage URL：你的私有站点地址
- Authorization callback URL：

```text
https://focus.example.com/api/auth/github/callback
```

### 4.2 写入容器环境变量

在 `.env` 中填写：

```env
GITHUB_CLIENT_ID=你的客户端ID
GITHUB_CLIENT_SECRET=你的客户端密钥
PUBLIC_ORIGIN=https://focus.example.com
```

修改后重启：

```bash
docker compose up -d
```

不要把 GitHub 密钥提交到 Git 仓库，也不要把 `.env` 放进镜像。

## 5. 使用 PostgreSQL（可选）

准备一个 PostgreSQL 数据库，然后修改 `.env`：

```env
DB_CLIENT=postgres
DATABASE_URL=postgres://user:password@postgres-host:5432/orbit_focus
```

如果 PostgreSQL 运行在另一个 Compose 服务中，可以使用服务名作为主机名。应用启动时会自动创建最新表结构和索引。

SQLite 和 PostgreSQL 是两套独立数据库，切换 `DB_CLIENT` 不会自动复制数据。

## 6. HTTPS 和反向代理

不要直接把 HTTP 端口暴露到公网。建议使用 Caddy、Nginx 或云厂商负载均衡终止 HTTPS，再代理到：

```text
127.0.0.1:3000
```

必须将 `PUBLIC_ORIGIN` 设置为用户实际访问的 HTTPS 地址，否则 GitHub OAuth 回调可能跳转到错误的 origin。

## 7. 常用运维命令

```bash
# 查看实时日志
docker compose logs -f --tail=200

# 重启
docker compose restart

# 重新构建并替换镜像
docker compose up -d --build

# 查看容器健康状态
docker inspect --format '{{.State.Health.Status}}' orbit-focus

# 进入容器
docker compose exec orbit-focus sh
```

## 8. 升级

本项目当前按全新数据库基线发布。升级前建议备份 `data/`：

```bash
docker compose down
cp -a data "data-backup-$(date +%F)"
git pull
docker compose up -d --build
```

如果未来需要改变数据库结构，应在项目中增加明确的版本迁移方案，不要直接修改生产数据库。

## 9. 常见问题

### `/api/health` 返回数据库错误

检查 `data/` 目录权限和 SQLite 文件是否可写：

```bash
ls -la data
docker compose logs --tail=100
```

### 登录按钮提示 OAuth 未配置

确认 `.env` 中存在 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`，并重启容器。GitHub 回调地址必须与注册值完全一致。

### 容器重启后数据消失

确认宿主机挂载目录存在，并且没有使用 `docker compose down -v`。`-v` 会删除 Compose 管理的卷；本项目使用宿主机 `./data` 绑定目录，但删除目录仍会丢数据。

### 只使用游客模式

可以不填写 GitHub OAuth 配置，只保留 `JWT_SECRET`。浏览器数据仍保存在访问者自己的浏览器中。
