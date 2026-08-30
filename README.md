# Orbit Focus - 全栈番茄钟应用

Orbit Focus 是一个基于 React + Node.js 全栈技术栈的番茄钟应用，支持本地 Express 开发和双平台部署（Cloudflare Workers 和 Vercel Serverless）。

## 技术栈

### 前端
- React 18
- TypeScript
- Vite
- Tailwind CSS

### 后端
- Node.js
- Express
- TypeScript
- SQLite (better-sqlite3)

### 部署平台
- Cloudflare Workers + D1
- Vercel Serverless Functions

## 项目结构

```
orbit-focus/
├── client/ # 前端代码
│ ├── src/ # 源代码
│ │ ├── components/ # React 组件
│ │ ├── contexts/ # React Context
│ │ ├── locales/ # 多语言翻译
│ │ ├── services/ # API 服务
│ │ ├── App.tsx # 主应用组件
│ │ └── index.tsx # 入口文件
│ ├── public/ # 静态资源
│ └── index.css # 全局样式
├── server/ # 本地 Express 后端
│ ├── src/
│ │ ├── controllers/ # 路由控制器
│ │ ├── models/ # 数据模型
│ │ ├── routes/ # 路由定义
│ │ └── index.ts # 服务器入口
│ └── data/ # SQLite 数据库文件
├── api/ # 平台特定 API 处理
│ ├── cloudflare/ # Cloudflare Workers 配置
│ └── vercel/ # Vercel Serverless 配置
├── shared/ # 共享代码
│ └── utils/ # 共享工具函数
├── package.json # 根项目配置
├── vite.config.ts # Vite 配置
├── tsconfig.json # TypeScript 配置（前端）
├── tsconfig.server.json # TypeScript 配置（后端）
├── tailwind.config.js # Tailwind CSS 配置
├── wrangler.toml # Cloudflare 部署配置
├── index.html # HTML 入口
└── eslint.config.js # ESLint 配置
```

## 功能特性

- 番茄钟计时功能
- 用户认证与授权
- 任务管理
- 统计数据
- 多语言支持
- 本地存储支持
- 云端同步

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

本项目支持一键自动部署到 Cloudflare Workers + D1 数据库。

快速开始：

```bash
# 一键初始化 + 部署
npm run setup
```

### Vercel 部署

```bash
vercel
```

## API 端点

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

### 本地开发
```
PORT=3000
```

## 许可证

MIT
