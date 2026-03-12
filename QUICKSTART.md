# Orbit Focus 快速启动指南

## 一键启动（推荐）

只需运行一个命令即可启动所有服务：

```bash
npm run dev
```

这个命令会自动：
-  启动前端开发服务器（端口 3000）
-  启动 Electron 桌面应用（包含后端 API，端口 8080）
-  启动 WebSocket 服务器（端口 8081）

就这么简单！

## 手动启动（高级）

如果你想单独启动某个服务：

```bash
# 只启动前端
npm run dev:client

# 只启动 Electron（包含后端）
npm run electron:dev
```

## 注意事项

- 首次运行前，请确保已安装所有依赖：`npm run install:all`
- 后端 API 已集成到 Electron 主进程中，不需要单独启动
- 如果遇到端口占用问题，请检查是否有其他进程占用了端口

## 服务端口

- 前端：http://localhost:3000
- 后端 API：http://localhost:8080（由 Electron 提供）
- WebSocket：ws://localhost:8081（由 Electron 提供）