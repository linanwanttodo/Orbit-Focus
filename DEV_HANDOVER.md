# Orbit Focus Desktop - 开发接力文档

## 项目状态 (2026-01-15 更新)

本项目是一个基于 Electron + React + Vite 的桌面端效率工具。目前主要功能模块包括番茄钟、任务表格以及 **WakaTime 编程时间统计**。

---

## 📅 最新更新：Code Time UI 增强 (2026-01-15)

### 1. 数据缓存机制

在 `electron/main.js` 中添加了 WakaTime API 数据缓存：

```javascript
const wakaTimeCache = {
  stats: { data: null, expiry: 0 },
  summaries: { data: null, expiry: 0 },
  statusBar: { data: null, expiry: 0 },
  insights: { data: null, expiry: 0 }
};
const CACHE_TTL = 10 * 60 * 1000; // 10分钟缓存
```

- 通用请求函数 `makeWakaTimeRequest()` 自动检查缓存
- 缓存有效时直接返回，避免重复请求
- 控制台日志显示 "Using cached data for xxx"

### 2. Insights API (热力图数据)

新增 IPC 处理程序获取年度活动数据：

```javascript
ipcMain.handle('wakatime:getInsights', async (event, apiKey) => {
  return makeWakaTimeRequest(apiKey, '/api/v1/users/current/insights/days/last_year', 'insights');
});
```

前端通过 `window.electron.getWakaTimeInsights(apiKey)` 调用。

### 3. Code Time UI 布局重构

**文件**: `client/src/components/CodeTimeView.tsx`

#### 布局结构
```
+----------------------------------+
|  今日编程时间  |  最佳编程日      |  <- 头部统计
+----------------------------------+
|       近7天活动 (堆叠柱状图)      |  <- 可滚动内容区
|  Coding / Writing Docs 分类显示  |
+----------------------------------+
|    编程语言    |     编辑器      |
|  (最多6个)     |   (最多6个)     |
+----------------------------------+
|       年度活动热力图 (固定底部)   |  <- flex-shrink-0
+----------------------------------+
```

#### 关键特性
- **堆叠柱状图**: 每天的编程时间按 Categories (Coding, Writing Docs 等) 分色显示
- **悬停 Tooltip**: 显示详细分类信息
- **热力图固定底部**: 使用 `flex-shrink-0` 实现类似侧边栏"设置"按钮的固定效果
- **响应式布局**: 语言/编辑器在大屏幕并排显示

### 4. 国际化完善

在 `client/src/locales/` 下的 `en.json`, `zh.json`, `ru.json` 添加了：

```json
{
  "codeTime": {
    "activityHeatmap": "年度活动"
  }
}
```

---

## 🛠️ 关键文件说明

### 前端

*   **`client/src/components/CodeTimeView.tsx`**
    *   负责 WakaTime 数据的获取、聚合计算和展示
    *   包含堆叠柱状图和热力图组件
    *   使用 `insights` state 存储热力图数据
    *   **注意**：修改此文件时请保持聚合逻辑的"防御性"

### 后端

*   **`electron/main.js`**
    *   Electron 主进程
    *   IPC 处理程序：
      - `wakatime:getStats` - 7天统计
      - `wakatime:getStatusBar` - 今日状态
      - `wakatime:getSummaries` - 7天详细流水
      - `wakatime:getInsights` - **年度热力图数据**
    *   WakaTime 数据缓存 (10分钟 TTL)

*   **`electron/preload.js`**
    *   暴露给前端的 API 接口
    *   包含 `getWakaTimeInsights()` 方法

---

## 🚀 开发指南

**启动开发环境：**
```bash
npm run dev
```
此命令会同时启动 Vite 前端服务 (port 3000+) 和 Electron 窗口。

**清理端口（如果遇到端口占用）：**
```bash
pkill -f "node.*vite"
```

---

## 📝 待办/注意事项

1.  **缓存策略**：当前缓存 TTL 为 10 分钟，可根据需要调整 `CACHE_TTL` 常量
2.  **热力图数据**：Insights API 免费账户可能有限制，需要检查 `is_up_to_date` 字段
3.  **Categories 数据**：堆叠柱状图依赖 Summaries API 返回的 `categories` 数组，WakaTime 免费账户可能不包含此数据
4.  **侧边栏宽度**：已从 `w-64` 调整为 `w-40`，对应 `ml-40` 的主内容区边距

---

## 📜 历史更新记录

### WakaTime 数据同步修复 (早期)

#### 核心问题与解决方案
*   **问题**：WakaTime 的 `/stats/last_7_days` 接口对于"今天"产生的最新代码时间，往往返回 0 或不完整
*   **修复方案**：
    *   后端：确保 `wakatime:getSummaries` 接口可用
    *   前端：实现**客户端聚合逻辑**，当主统计接口返回空数据时自动计算

#### 黑屏/崩溃修复
*   添加了严格的 **Null Checks** 和 **Array Checks**
*   使用 Optional Chaining (`?.`) 和默认值 fallback (`|| 0`)
*   修正了 `useMemo` 的调用顺序，遵守 React Rules of Hooks
