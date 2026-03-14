import { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, net, shell, Notification } from 'electron';
import * as path from 'path';
import * as url from 'url';
import * as os from 'os';
import * as fs from 'fs';
import { exec } from 'child_process';
import express from 'express';
import cors from 'cors';

// 导入后端模块
import { initializeDatabase } from '../server/src/database';
import taskRoutes from '../server/src/routes/tasks';
import sessionRoutes from '../server/src/routes/sessions';

let mainWindow: BrowserWindow | null = null;
let dynamicIslandWindow: BrowserWindow | null = null;
let expressServer: any = null;
let serverPort: number | null = null;
let tray: Tray | null = null;

// 定义应用状态扩展
interface AppExtended extends Electron.App {
    isQuitting?: boolean;
}

const extendedApp = app as AppExtended;

// WakaTime 数据缓存接口
interface CacheEntry {
    data: any;
    expiry: number;
}

interface WakaTimeCache {
    [key: string]: CacheEntry;
}

const wakaTimeCache: WakaTimeCache = {
    stats: { data: null, expiry: 0 },
    summaries: { data: null, expiry: 0 },
    statusBar: { data: null, expiry: 0 },
    insights: { data: null, expiry: 0 }
};

const CACHE_TTL = 10 * 60 * 1000; // 10分钟缓存

// 检查缓存是否有效
function isCacheValid(cacheKey: string): boolean {
    const cache = wakaTimeCache[cacheKey];
    return cache && cache.data && Date.now() < cache.expiry;
}

// 设置缓存
function setCache(cacheKey: string, data: any): void {
    wakaTimeCache[cacheKey] = {
        data: data,
        expiry: Date.now() + CACHE_TTL
    };
}

// 清除所有缓存
function clearAllCache(): void {
    Object.keys(wakaTimeCache).forEach(key => {
        wakaTimeCache[key] = { data: null, expiry: 0 };
    });
    console.log('WakaTime cache cleared');
}

// 创建托盘图标
function createTrayIcon(): Electron.NativeImage {
    // 使用自定义图标
    const iconPath = path.join(__dirname, '../build/icon.png');
    if (fs.existsSync(iconPath)) {
        return nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    }
    // 降级：使用红色圆点
    const size = 16;
    const canvas = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="#ef4444"/>
    </svg>
  `;
    return nativeImage.createFromDataURL(
        `data:image/svg+xml;base64,${Buffer.from(canvas).toString('base64')}`
    );
}

// 移除强制禁用，因为在某些 Linux 下会导致窗口完全消失
// app.disableHardwareAcceleration();

function createWindow(): void {
    const iconPath = path.join(__dirname, '../build/icon.png');
    
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        transparent: false,
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#0B0C15',
        show: false
    });

    // 设置 Content Security Policy
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:* https://wakatime.com https://api.wakatime.com;"
                ]
            }
        });
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        // 生产环境：使用 app.getAppPath() 获取 asar 根路径
        const appRoot = app.getAppPath();
        mainWindow.loadFile(path.join(appRoot, 'client/dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.on('close', (event) => {
        if (!extendedApp.isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}


function createTray(): void {
    const icon = createTrayIcon();
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示窗口',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: '隐藏窗口',
            click: () => {
                mainWindow?.hide();
            }
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                extendedApp.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Orbit Focus');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

function registerGlobalShortcuts(): void {
    globalShortcut.register('CommandOrControl+Shift+O', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });

    globalShortcut.register('CommandOrControl+Shift+P', () => {
        mainWindow?.webContents.send('toggle-timer');
    });

    globalShortcut.register('CommandOrControl+Shift+R', () => {
        mainWindow?.webContents.send('reset-timer');
    });

    console.log('全局快捷键已注册');
}

// === IPC 通信处理 ===

ipcMain.handle('set-auto-launch', (_event, enabled: boolean) => {
    app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true
    });
    return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('get-auto-launch', () => {
    return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('minimize-to-tray', () => {
    mainWindow?.hide();
});

ipcMain.handle('window-minimize', () => {
    mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
        return mainWindow.isMaximized();
    }
    return false;
});

ipcMain.handle('window-close', () => {
    mainWindow?.hide();
});

// 设置窗口置顶
ipcMain.handle('window-set-always-on-top', (_event, alwaysOnTop: boolean) => {
    if (mainWindow) {
        mainWindow.setAlwaysOnTop(alwaysOnTop, 'floating');
    }
    return mainWindow ? mainWindow.isAlwaysOnTop() : false;
});

// 获取窗口置顶状态
ipcMain.handle('window-is-always-on-top', () => {
    return mainWindow ? mainWindow.isAlwaysOnTop() : false;
});


// 通用的 WakaTime API 请求函数
const makeWakaTimeRequest = (apiKey: string, apiPath: string, cacheKey: string, forceRefresh = false, baseUrl = 'https://wakatime.com') => {
    return new Promise((resolve, reject) => {
        if (!forceRefresh && cacheKey && isCacheValid(cacheKey)) {
            console.log(`Using cached data for ${cacheKey}`);
            resolve(wakaTimeCache[cacheKey].data);
            return;
        }

        let parsedUrl: url.URL;
        try {
            const finalBaseUrl = baseUrl.includes('://') ? baseUrl : `https://${baseUrl}`;
            parsedUrl = new url.URL(finalBaseUrl);
        } catch (e) {
            console.error('Invalid WakaTime Base URL:', baseUrl);
            parsedUrl = new url.URL('https://wakatime.com');
        }

        const { protocol, hostname } = parsedUrl;
        const encodedKey = Buffer.from(apiKey.trim()).toString('base64');

        const commonHeaders: Record<string, string> = {
            'Authorization': `Basic ${encodedKey}`,
            'X-WakaTime-API-Key': apiKey.trim(),
            'Content-Type': 'application/json',
            'User-Agent': 'OrbitFocus/1.0.0 (Linux; Electron)'
        };

        const request = net.request({
            method: 'GET',
            protocol: protocol as any,
            hostname: hostname,
            path: apiPath,
            headers: commonHeaders
        });

        request.on('response', (response) => {
            console.log(`[WakaTime] ${cacheKey || apiPath} 返回状态码: ${response.statusCode}`);
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            response.on('end', () => {
                try {
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        const parsed = JSON.parse(data);
                        if (cacheKey) setCache(cacheKey, parsed);
                        resolve(parsed);
                    } else if (response.statusCode === 401) {
                        const retryEncodedKey = Buffer.from(`${apiKey.trim()}:`).toString('base64');
                        console.log(`[WakaTime] 401 错误，尝试带冒号的重试...`);

                        const retryRequest = net.request({
                            method: 'GET',
                            protocol: protocol as any,
                            hostname: hostname,
                            path: apiPath,
                            headers: {
                                ...commonHeaders,
                                'Authorization': `Basic ${retryEncodedKey}`
                            }
                        });

                        retryRequest.on('response', (retryRes) => {
                            let retryData = '';
                            retryRes.on('data', (c) => retryData += c);
                            retryRes.on('end', () => {
                                if (retryRes.statusCode >= 200 && retryRes.statusCode < 300) {
                                    const p = JSON.parse(retryData);
                                    if (cacheKey) setCache(cacheKey, p);
                                    resolve(p);
                                } else {
                                    reject(new Error(`WakaTime API Error (Final): ${retryRes.statusCode} - ${retryData}`));
                                }
                            });
                        });

                        retryRequest.on('error', reject);
                        retryRequest.end();
                    } else {
                        reject(new Error(`WakaTime API Error: ${response.statusCode} - ${data}`));
                    }
                } catch (e: any) {
                    reject(new Error(`Failed to parse response: ${e.message}`));
                }
            });
        });

        request.on('error', (error) => {
            console.error('[WakaTime] 请求失败:', error);
            reject(error);
        });

        request.end();
    });
};

ipcMain.handle('wakatime:getStats', async (_event, apiKey: string, forceRefresh = false, baseUrl: string) => {
    return makeWakaTimeRequest(apiKey, '/api/v1/users/current/stats/last_7_days', 'stats', forceRefresh, baseUrl);
});

ipcMain.handle('wakatime:getSummaries', async (_event, apiKey: string, forceRefresh = false, baseUrl: string) => {
    return makeWakaTimeRequest(apiKey, '/api/v1/users/current/summaries?range=last_7_days', 'summaries', forceRefresh, baseUrl);
});

ipcMain.handle('wakatime:getStatusBar', async (_event, apiKey: string, forceRefresh = false, baseUrl: string) => {
    return makeWakaTimeRequest(apiKey, '/api/v1/users/current/status_bar/today', 'statusBar', forceRefresh, baseUrl);
});

ipcMain.handle('wakatime:getInsights', async (_event, apiKey: string, forceRefresh = false, baseUrl: string) => {
    return makeWakaTimeRequest(apiKey, '/api/v1/users/current/summaries?range=last_7_days', 'insights', forceRefresh, baseUrl);
});

ipcMain.handle('wakatime:clearCache', async () => {
    clearAllCache();
    return { success: true };
});

ipcMain.handle('wakatime:syncConfig', async (_event, apiKey: string, baseUrl: string) => {
    const configPath = path.join(os.homedir(), '.wakatime.cfg');

    try {
        let content = '';
        if (fs.existsSync(configPath)) {
            content = fs.readFileSync(configPath, 'utf8');
        }

        const settingsSection = '[settings]';
        let lines = content.split('\n');
        let settingsStartIndex = lines.findIndex(line => line.trim() === settingsSection);

        const api_url = baseUrl.endsWith('/api/v1') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/api/v1`;

        if (settingsStartIndex === -1) {
            lines.push(settingsSection);
            lines.push(`api_key = ${apiKey}`);
            lines.push(`api_url = ${api_url}`);
        } else {
            const updateOrAdd = (key: string, value: string) => {
                const index = lines.findIndex((line, i) => i > settingsStartIndex && line.trim().startsWith(`${key} =`));
                if (index !== -1) {
                    lines[index] = `${key} = ${value}`;
                } else {
                    lines.splice(settingsStartIndex + 1, 0, `${key} = ${value}`);
                }
            };
            updateOrAdd('api_key', apiKey);
            updateOrAdd('api_url', api_url);
        }

        fs.writeFileSync(configPath, lines.join('\n'), 'utf8');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to sync WakaTime config:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('wakatime:installVSCodePlugin', async () => {
    return new Promise((resolve) => {
        exec('code --install-extension wakatime.vscode-wakatime', (error, stdout, _stderr) => {
            if (error) {
                console.error('Failed to install VS Code plugin:', error);
                resolve({ success: false, error: error.message });
                return;
            }
            resolve({ success: true, output: stdout });
        });
    });
});

ipcMain.handle('show-notification', (_event, title: string, body: string) => {
    new Notification({ title, body }).show();
});

// === 禅静模式：仅屏蔽弹窗，保留消息记录 ===
ipcMain.handle('set-zen-mode', async (_event, enabled: boolean) => {
    return new Promise((resolve) => {
        const platform = process.platform;
        let command = '';

        if (platform === 'linux') {
            // GNOME 环境下仅屏蔽横幅弹窗
            command = `gsettings set org.gnome.desktop.notifications show-banners ${!enabled}`;
        } else if (platform === 'win32') {
            // Windows 下修改注册表禁显 Toast 弹窗
            command = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings" /v "NOC_GLOBAL_SETTING_ALLOW_TOASTS" /t REG_DWORD /d ${enabled ? 0 : 1} /f`;
        } else if (platform === 'darwin') {
            // macOS 下设置勿扰模式（脚本方式）
            command = `defaults write com.apple.ncprefs doNotDisturb -boolean ${enabled}`;
        }

        if (!command) {
            resolve({ success: false, message: 'Unsupported platform' });
            return;
        }

        exec(command, (error) => {
            if (error) {
                console.error(`[ZenMode] Failed to ${enabled ? 'enable' : 'disable'}:`, error);
                resolve({ success: false, error: error.message });
            } else {
                console.log(`[ZenMode] ${enabled ? 'Enabled' : 'Disabled'} on ${platform}`);
                resolve({ success: true });
            }
        });
    });
});

ipcMain.handle('window-is-maximized', () => {
    return mainWindow?.isMaximized() || false;
});

// === 一键卸载功能（跨平台） ===
ipcMain.handle('app:uninstall', async () => {
    const platform = process.platform;
    const { exec } = await import('child_process');
    const fs = await import('fs');
    const os = await import('os');
    const pathMod = await import('path');
    const homeDir = os.homedir();
    
    if (platform === 'linux') {
        // Linux: 检测 deb 或 pacman 包
        const checkDeb = new Promise<boolean>((resolve) => {
            exec('dpkg -l orbit-focus 2>/dev/null | grep -q orbit-focus && echo "installed"', (error, stdout) => {
                resolve(!error && stdout.includes('installed'));
            });
        });
        
        const checkPacman = new Promise<boolean>((resolve) => {
            exec('pacman -Qi orbit-focus 2>/dev/null | grep -q orbit-focus && echo "installed"', (error, stdout) => {
                resolve(!error && stdout.includes('installed'));
            });
        });
        
        const [isDeb, isPacman] = await Promise.all([checkDeb, checkPacman]);
        
        return new Promise(async (resolve) => {
            let command = '';
            
            if (isDeb) {
                command = 'pkexec apt remove -y orbit-focus && pkexec apt autoremove -y';
            } else if (isPacman) {
                command = 'pkexec pacman -R --noconfirm orbit-focus';
            } else {
                // AppImage 或开发模式，仅清除数据
                let configDir = pathMod.join(homeDir, '.config', 'orbit-focus');
                let dataDir = pathMod.join(homeDir, '.local', 'share', 'orbit-focus');
                
                try {
                    if (fs.existsSync(configDir)) fs.rmSync(configDir, { recursive: true, force: true });
                    if (fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
                    const desktopFile = pathMod.join(homeDir, '.local', 'share', 'applications', 'orbit-focus.desktop');
                    if (fs.existsSync(desktopFile)) fs.unlinkSync(desktopFile);
                    
                    resolve({ success: true, message: '用户数据已清除，请手动删除 AppImage 文件' });
                    return;
                } catch (error: any) {
                    resolve({ success: false, error: error.message });
                    return;
                }
            }
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error('[Uninstall] 卸载失败:', error);
                    resolve({ success: false, error: error.message });
                } else {
                    console.log('[Uninstall] 卸载成功');
                    // 清除剩余数据
                    let configDir = pathMod.join(homeDir, '.config', 'orbit-focus');
                    let dataDir = pathMod.join(homeDir, '.local', 'share', 'orbit-focus');
                    if (fs.existsSync(configDir)) fs.rmSync(configDir, { recursive: true, force: true });
                    if (fs.existsSync(dataDir)) fs.rmSync(dataDir, { recursive: true, force: true });
                    resolve({ success: true, message: '卸载成功' });
                }
            });
        });
        
    } else if (platform === 'win32') {
        // Windows: 调用系统卸载程序
        return new Promise((resolve) => {
            const appData = process.env.APPDATA || homeDir;
            const configDir = pathMod.join(appData, 'orbit-focus');
            
            // 尝试从注册表获取卸载信息
            exec('wmic product where "name like \'%Orbit Focus%\'" get UninstallString /value', (error: any, stdout: string) => {
                if (error || !stdout) {
                    // 找不到安装信息，仅清除数据
                    if (fs.existsSync(configDir)) fs.rmSync(configDir, { recursive: true, force: true });
                    resolve({ success: true, message: '数据已清除，请通过控制面板卸载应用' });
                    return;
                }
                
                const match = stdout.match(/UninstallString=(.+)/);
                if (match) {
                    const uninstallCmd = match[1].trim();
                    exec(uninstallCmd, (err: any) => {
                        if (err) {
                            resolve({ success: false, error: err.message });
                        } else {
                            // 清除剩余数据
                            if (fs.existsSync(configDir)) fs.rmSync(configDir, { recursive: true, force: true });
                            resolve({ success: true, message: '卸载成功' });
                        }
                    });
                } else {
                    resolve({ success: false, error: '未找到卸载程序' });
                }
            });
        });
        
    } else if (platform === 'darwin') {
        // macOS: 移动到废纸篓
        return new Promise((resolve) => {
            const appPath = pathMod.dirname(pathMod.dirname(process.execPath));
            exec(`osascript -e 'tell application "Finder" to delete POSIX file "${appPath}"'`, (error: any) => {
                if (error) {
                    // 无法自动删除，仅清除数据
                    const configDir = pathMod.join(homeDir, 'Library', 'Application Support', 'orbit-focus');
                    if (fs.existsSync(configDir)) fs.rmSync(configDir, { recursive: true, force: true });
                    resolve({ success: true, message: '数据已清除，请将应用拖到废纸篓' });
                } else {
                    // 清除数据
                    const configDir = pathMod.join(homeDir, 'Library', 'Application Support', 'orbit-focus');
                    if (fs.existsSync(configDir)) fs.rmSync(configDir, { recursive: true, force: true });
                    resolve({ success: true, message: '卸载成功' });
                }
            });
        });
    }
    
    return { success: false, error: '不支持的平台' };
});

// === 一键清除数据功能 ===
ipcMain.handle('app:clearData', async () => {
    const fs = await import('fs');
    const os = await import('os');
    const pathMod = await import('path');
    const homeDir = os.homedir();
    const platform = process.platform;
    
    try {
        let deletedCount = 0;
        
        // 1. 删除配置目录（跨平台）
        let configDir: string;
        if (platform === 'win32') {
            configDir = pathMod.join(process.env.APPDATA || homeDir, 'orbit-focus');
        } else if (platform === 'darwin') {
            configDir = pathMod.join(homeDir, 'Library', 'Application Support', 'orbit-focus');
        } else {
            configDir = pathMod.join(homeDir, '.config', 'orbit-focus');
        }
        
        if (fs.existsSync(configDir)) {
            fs.rmSync(configDir, { recursive: true, force: true });
            deletedCount++;
            console.log('[ClearData] 已删除:', configDir);
        }
        
        // 2. 删除数据目录（跨平台）
        let dataDir: string;
        if (platform === 'win32') {
            dataDir = pathMod.join(process.env.LOCALAPPDATA || homeDir, 'orbit-focus', 'data');
        } else if (platform === 'darwin') {
            dataDir = pathMod.join(homeDir, 'Library', 'Application Support', 'orbit-focus');
        } else {
            dataDir = pathMod.join(homeDir, '.local', 'share', 'orbit-focus');
        }
        
        if (fs.existsSync(dataDir)) {
            fs.rmSync(dataDir, { recursive: true, force: true });
            deletedCount++;
            console.log('[ClearData] 已删除:', dataDir);
        }
        
        // 3. 删除项目根目录的 data 数据库文件（统一位置）
        const appDataPath = pathMod.join(__dirname, '../../../data');
        if (fs.existsSync(appDataPath)) {
            const files = fs.readdirSync(appDataPath);
            for (const file of files) {
                if (file.endsWith('.db') || file.endsWith('.sqlite')) {
                    fs.unlinkSync(pathMod.join(appDataPath, file));
                    deletedCount++;
                    console.log('[ClearData] 已删除:', pathMod.join(appDataPath, file));
                }
            }
        }
        
        // 4. 删除 Electron 应用数据目录下的数据库（生产环境 - 跨平台）
        const appDir = pathMod.dirname(process.execPath);
        const possibleDbPaths: string[] = [];
        
        if (platform === 'win32') {
            possibleDbPaths.push(
                pathMod.join(appDir, 'data', 'orbit-focus.db'),
                pathMod.join(appDir, '..', 'data', 'orbit-focus.db'),
                pathMod.join(process.resourcesPath || '', 'data', 'orbit-focus.db')
            );
        } else if (platform === 'darwin') {
            possibleDbPaths.push(
                pathMod.join(appDir, '..', 'Resources', 'data', 'orbit-focus.db'),
                pathMod.join(appDir, 'data', 'orbit-focus.db'),
                pathMod.join(process.resourcesPath || '', 'data', 'orbit-focus.db')
            );
        } else {
            possibleDbPaths.push(
                pathMod.join(appDir, 'data', 'orbit-focus.db'),
                pathMod.join(appDir, '..', 'data', 'orbit-focus.db'),
                pathMod.join(process.resourcesPath || '', 'data', 'orbit-focus.db')
            );
        }
        
        for (const dbPath of possibleDbPaths) {
            if (fs.existsSync(dbPath)) {
                fs.unlinkSync(dbPath);
                deletedCount++;
                console.log('[ClearData] 已删除:', dbPath);
            }
        }
        
        console.log('[ClearData] 清除完成，共删除', deletedCount, '个数据项');
        return { success: true, message: `已清除 ${deletedCount} 个数据项` };
    } catch (error: any) {
        console.error('[ClearData] 清除数据失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-server-port', () => {
    return serverPort || 8080;
});

ipcMain.handle('open-external', async (_event, externalUrl: string) => {
    await shell.openExternal(externalUrl);
});

async function startExpressServer(): Promise<void> {
    const expressApp = express();
    expressApp.use(cors());
    expressApp.use(express.json());

    try {
        console.log('[Backend] 初始化数据库...');
        initializeDatabase();
        console.log('[Backend] 数据库初始化成功');
    } catch (error) {
        console.error('[Backend] 数据库初始化失败:', error);
    }

    expressApp.use('/api/tasks', taskRoutes);
    expressApp.use('/api/sessions', sessionRoutes);

    expressApp.get('/api/health', (_req, res) => {
        res.status(200).json({ status: 'ok', message: 'Orbit Focus API is running' });
    });

    const PORT = 8080;
    serverPort = PORT;

    try {
        expressServer = expressApp.listen(PORT, () => {
            console.log(`[Backend] Express 服务器已启动，端口: ${PORT}`);
        });

        expressServer.on('error', (error: any) => {
            console.error('[Backend] 服务器错误:', error.message);
        });
    } catch (error) {
        console.error('[Backend] 启动服务器失败:', error);
    }
}

app.whenReady().then(() => {
    createWindow();
    createTray();
    registerGlobalShortcuts();
    startExpressServer();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    extendedApp.isQuitting = true;
    globalShortcut.unregisterAll();
    if (expressServer) {
        expressServer.close();
    }
});
