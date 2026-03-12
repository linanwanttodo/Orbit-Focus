import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
    versions: process.versions,

    // === 计时器控制相关 ===

    // 监听全局快捷键 - 暂停/继续计时器
    onToggleTimer: (callback: () => void) => {
        ipcRenderer.on('toggle-timer', () => {
            callback();
        });
    },

    // 监听全局快捷键 - 重置计时器
    onResetTimer: (callback: () => void) => {
        ipcRenderer.on('reset-timer', () => {
            callback();
        });
    },

    // === 窗口控制相关 ===

    // 切换窗口置顶
    setAlwaysOnTop: (alwaysOnTop: boolean) => {
        return ipcRenderer.invoke('window-set-always-on-top', alwaysOnTop);
    },

    // 获取窗口置顶状态
    isAlwaysOnTop: () => {
        return ipcRenderer.invoke('window-is-always-on-top');
    },

    // 最小化到托盘
    minimizeToTray: () => {
        return ipcRenderer.invoke('minimize-to-tray');
    },

    // === 窗口控制（用于自定义标题栏） ===

    // 最小化窗口
    windowMinimize: () => {
        return ipcRenderer.invoke('window-minimize');
    },

    // 最大化/还原窗口
    windowMaximize: () => {
        return ipcRenderer.invoke('window-maximize');
    },

    // 关闭窗口
    windowClose: () => {
        return ipcRenderer.invoke('window-close');
    },

    // 获取窗口最大化状态
    windowIsMaximized: () => {
        return ipcRenderer.invoke('window-is-maximized');
    },

    // === 开机自启动相关 ===

    // 设置开机自启动
    setAutoLaunch: (enabled: boolean) => {
        return ipcRenderer.invoke('set-auto-launch', enabled);
    },

    // 获取开机自启动状态
    getAutoLaunch: () => {
        return ipcRenderer.invoke('get-auto-launch');
    },

    // === WakaTime 集成 ===
    getWakaTimeStats: (apiKey: string, forceRefresh = false, baseUrl?: string) => {
        return ipcRenderer.invoke('wakatime:getStats', apiKey, forceRefresh, baseUrl);
    },
    getWakaTimeStatusBar: (apiKey: string, forceRefresh = false, baseUrl?: string) => {
        return ipcRenderer.invoke('wakatime:getStatusBar', apiKey, forceRefresh, baseUrl);
    },
    getWakaTimeSummaries: (apiKey: string, forceRefresh = false, baseUrl?: string) => {
        return ipcRenderer.invoke('wakatime:getSummaries', apiKey, forceRefresh, baseUrl);
    },
    getWakaTimeInsights: (apiKey: string, forceRefresh = false, baseUrl?: string) => {
        return ipcRenderer.invoke('wakatime:getInsights', apiKey, forceRefresh, baseUrl);
    },
    syncWakaTimeConfig: (apiKey: string, baseUrl: string) => {
        return ipcRenderer.invoke('wakatime:syncConfig', apiKey, baseUrl);
    },
    installVSCodePlugin: () => {
        return ipcRenderer.invoke('wakatime:installVSCodePlugin');
    },
    clearWakaTimeCache: () => {
        return ipcRenderer.invoke('wakatime:clearCache');
    },

    // === 系统通知 ===
    showNotification: (title: string, body: string) => {
        return ipcRenderer.invoke('show-notification', title, body);
    },

    // 设置禅静模式
    setZenMode: (enabled: boolean) => {
        return ipcRenderer.invoke('set-zen-mode', enabled);
    },

    // === 服务器配置 ===
    getServerPort: () => {
        return ipcRenderer.invoke('get-server-port');
    },

    // === 外部链接 ===
    openExternal: (url: string) => {
        return ipcRenderer.invoke('open-external', url);
    },

    // === 一键卸载 ===
    uninstallApp: () => {
        return ipcRenderer.invoke('app:uninstall');
    },

    // === 一键清除数据 ===
    clearAppData: () => {
        return ipcRenderer.invoke('app:clearData');
    },

    // === 清理相关 ===

    // 移除所有监听器
    removeAllListeners: () => {
        ipcRenderer.removeAllListeners('toggle-timer');
        ipcRenderer.removeAllListeners('reset-timer');
    }
});
