export enum TimerMode {
  WORK = 'WORK',
  SHORT_BREAK = 'SHORT_BREAK',
  LONG_BREAK = 'LONG_BREAK',
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
}

export interface TimerConfig {
  [TimerMode.WORK]: number;
  [TimerMode.SHORT_BREAK]: number;
  [TimerMode.LONG_BREAK]: number;
}

export interface CodeTimeData {
  file: string;
  language: string;
  duration: number;
  timestamp: string;
}

// Electron 相关类型
// Electron 相关类型
export interface ElectronAPI {
  platform: string;
  versions: NodeJS.ProcessVersions;

  // 计时器控制相关
  onToggleTimer?: (callback: () => void) => void;
  onResetTimer?: (callback: () => void) => void;

  // 窗口控制
  setAlwaysOnTop?: (alwaysOnTop: boolean) => Promise<boolean>;
  isAlwaysOnTop?: () => Promise<boolean>;
  minimizeToTray?: () => Promise<void>;

  // 窗口控制（用于自定义标题栏）
  windowMinimize?: () => Promise<void>;
  windowMaximize?: () => Promise<boolean>;
  windowClose?: () => Promise<void>;
  windowIsMaximized?: () => Promise<boolean>;


  // 开机自启动
  setAutoLaunch?: (enabled: boolean) => Promise<boolean>;
  getAutoLaunch?: () => Promise<boolean>;

  // 清理
  // 清理
  removeAllListeners?: () => void;

  // WakaTime
  getWakaTimeStats?: (apiKey: string, forceRefresh?: boolean, baseUrl?: string) => Promise<WakaTimeStats>;
  getWakaTimeStatusBar?: (apiKey: string, forceRefresh?: boolean, baseUrl?: string) => Promise<WakaTimeStatusBar>;
  getWakaTimeSummaries?: (apiKey: string, forceRefresh?: boolean, baseUrl?: string) => Promise<WakaTimeSummaries>;
  getWakaTimeInsights?: (apiKey: string, forceRefresh?: boolean, baseUrl?: string) => Promise<any>;
  syncWakaTimeConfig?: (apiKey: string, baseUrl: string) => Promise<{ success: boolean; error?: string }>;
  installVSCodePlugin?: () => Promise<{ success: boolean; output?: string; error?: string }>;
  clearWakaTimeCache?: () => Promise<{ success: boolean }>;

  // 系统通知
  showNotification?: (title: string, body: string) => Promise<void>;

  // 禅静模式
  setZenMode?: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;

  // 服务器配置
  getServerPort?: () => Promise<number>;

  // 外部链接
  openExternal?: (url: string) => Promise<void>;
}

export interface WakaTimeStats {
  data: {
    total_seconds: number;
    daily_average: number;
    human_readable_total: string;
    human_readable_daily_average: string;
    languages: Array<{ name: string; percent: number; text: string }>;
    editors: Array<{ name: string; percent: number; text: string }>;
    best_day: { date: string; text: string };
  };
}

export interface WakaTimeStatusBar {
  data: {
    grand_total: {
      hours: number;
      minutes: number;
      text: string;
      total_seconds: number;
    };
    range: {
      text: string;
    };
  };
}

export interface WakaTimeSummaries {
  data: Array<{
    grand_total: {
      hours: number;
      minutes: number;
      text: string;
      total_seconds: number;
    };
    range: {
      date: string;
      text: string;
    };
    languages: Array<{ name: string; percent: number; text: string; total_seconds: number }>;
    editors: Array<{ name: string; percent: number; text: string; total_seconds: number }>;
  }>;
}


// 扩展 Window 接口
declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}
