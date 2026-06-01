# Orbit Focus - 全栈番茄钟应用

Orbit Focus 是一个基于 Node.js 全栈技术栈的番茄钟应用，支持双平台部署（Cloudflare 和 Vercel）。

## 技术栈

### 前端
- React 19
- TypeScript
- Vite
- Ant Design
- Tailwind CSS

### 后端
- Node.js
- Express
- TypeScript
- JWT 认证
- PBKDF2 密码哈希

### 部署平台
- Cloudflare Workers
- Vercel

## 项目结构

```
orbit-focus/
├── client/                 # 前端代码
│   ├── src/                # 源代码
│   ├── public/             # 静态资源
│   ├── package.json        # 前端依赖
│   ├── vite.config.ts      # Vite配置
│   └── tsconfig.json       # TypeScript配置
├── server/                 # 后端代码
│   ├── src/                # 源代码
│   ├── package.json        # 后端依赖
│   ├── tsconfig.json       # TypeScript配置
│   └── .env.example        # 环境变量示例
├── shared/                 # 共享代码
│   ├── types/              # TypeScript类型定义
│   └── utils/              # 共享工具函数
├── api/                    # 平台特定API处理
│   ├── cloudflare/         # Cloudflare Workers配置
│   └── vercel/             # Vercel配置
├── package.json            # 根项目配置
├── wrangler.toml           # Cloudflare部署配置
├── vercel.json             # Vite部署配置
└── .gitignore              # Git忽略文件
```

## 功能特性

- 🎯 番茄钟计时功能
- 👤 用户认证与授权
- 📝 任务管理
- 📊 统计数据
- 🌍 多语言支持
- 💾 本地存储支持
- ☁️  云端同步

## 安装与运行

### 1. 安装依赖

```bash
# 安装所有依赖
npm run install:all
```

### 2. 开发模式

```bash
# 启动前端开发服务器
npm run dev:client

# 启动后端开发服务器
npm run dev:server
```

### 3. 构建生产版本

```bash
# 构建前端和后端
npm run build

# 只构建前端
npm run build:client

# 只构建后端
npm run build:server
```

## 部署

### Cloudflare 部署（推荐）

本项目支持一键自动部署到 Cloudflare Workers + D1 数据库。详见 **[Cloudflare 部署指南](./DEPLOY.md)**。

快速开始：

```bash
# 一键初始化 + 部署
npm run setup
```

### Vercel 部署

```bash
npm install -g vercel
vercel login
vercel
```

### Vercel部署

1. 安装Vercel CLI

```bash
npm install -g vercel
```

2. 登录Vercel

```bash
vercel login
```

3. 部署到Vercel

```bash
vercel
```

## API端点

### 认证
- `POST /api/auth/register` - 注册新用户
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息

### 任务管理
- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建新任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务

### 会话管理
- `GET /api/sessions` - 获取会话列表
- `POST /api/sessions` - 创建新会话
- `PUT /api/sessions/:id` - 更新会话
- `DELETE /api/sessions/:id` - 删除会话
- `GET /api/sessions/stats` - 获取会话统计数据

## 环境变量

### 前端环境变量
```
VITE_API_URL=http://localhost:3000/api
```

### 后端环境变量
```
PORT=3000
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=1h
```

## 许可证

MIT
