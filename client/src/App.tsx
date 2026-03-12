import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TimerMode, Task } from './types';
import { DEFAULT_TIMES, MODE_COLORS } from './constants';
import { TimerRing } from './components/TimerRing';
import { TaskList } from './components/TaskList';
import { CodeTimeView } from './components/CodeTimeView';
import { CodeTypingView } from './components/CodeTypingView';
import TitleBar from './components/TitleBar';
import { useI18n, LanguageSwitcher } from './contexts/I18nContext';
import { getUserStats } from './services/apiService';
import { saveSessionData, saveTaskData } from './services/dataSyncService';
import { useTheme, THEME_COLORS, ThemeColorKey, ThemeProvider } from './contexts/ThemeContext';
import { StatsView } from './components/StatsView';

// --- View Components ---

// THEME_COLORS moved to ThemeContext

interface SettingsViewProps {
  showSeconds: boolean;
  toggleShowSeconds: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ showSeconds, toggleShowSeconds }) => {
  const { t } = useI18n();
  const [wakatimeKey, setWakatimeKey] = useState(localStorage.getItem('wakatime_api_key') || '');
  const [apiBaseUrl, setApiBaseUrl] = useState(localStorage.getItem('wakatime_api_url') || 'https://wakatime.com');
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showConfigSynced, setShowConfigSynced] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    localStorage.getItem('notifications_enabled') === 'true'
  );
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);

  const handleSaveWakaTime = async () => {
    localStorage.setItem('wakatime_api_key', wakatimeKey);
    localStorage.setItem('wakatime_api_url', apiBaseUrl);
    setShowSaveSuccess(true);

    // 强制清除主进程缓存以应用新设置
    if (window.electron?.clearWakaTimeCache) {
      window.electron.clearWakaTimeCache();
    }

    // 同步到系统配置 ~/.wakatime.cfg
    if (window.electron?.syncWakaTimeConfig) {
      const result = await window.electron.syncWakaTimeConfig(wakatimeKey, apiBaseUrl);
      if (result.success) {
        setShowConfigSynced(true);
        setTimeout(() => setShowConfigSynced(false), 3000);
      }
    }

    setTimeout(() => setShowSaveSuccess(false), 2000);
  };

  const handleInstallPlugin = () => {
    if (window.electron?.openExternal) {
      window.electron.openExternal('https://wakatime.com/plugins');
    } else {
      window.open('https://wakatime.com/plugins', '_blank');
    }
  };

  const handleInstallVSCode = async () => {
    if (isInstalling) return;
    setIsInstalling(true);
    try {
      if (window.electron?.installVSCodePlugin) {
        const result = await window.electron.installVSCodePlugin();
        if (result.success) {
          // 可以显示成功通知
          if (window.electron.showNotification) {
            window.electron.showNotification('WakaTime', t('common.success'));
          }
        } else {
          // 失败则跳转
          handleInstallPlugin();
        }
      }
    } catch (e) {
      handleInstallPlugin();
    } finally {
      setIsInstalling(false);
    }
  };

  const toggleNotifications = () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    localStorage.setItem('notifications_enabled', String(newValue));
  };

  const handleUninstall = async () => {
    if (isUninstalling) return;
    setIsUninstalling(true);
    try {
      if (window.electron?.uninstallApp) {
        const result = await window.electron.uninstallApp();
        if (result.success) {
          if (window.electron.showNotification) {
            window.electron.showNotification(t('settings.uninstall'), t('settings.uninstallSuccess'));
          }
          // 退出应用
          setTimeout(() => {
            if (window.electron?.windowClose) {
              window.electron.windowClose();
            } else {
              window.close();
            }
          }, 2000);
        } else {
          if (window.electron.showNotification) {
            window.electron.showNotification(t('settings.uninstall'), result.error || t('common.error'));
          }
        }
      }
    } catch (e: any) {
      if (window.electron.showNotification) {
        window.electron.showNotification(t('settings.uninstall'), e.message || t('common.error'));
      }
    } finally {
      setIsUninstalling(false);
      setShowUninstallConfirm(false);
    }
  };

  const handleClearData = async () => {
    if (isClearingData) return;
    setIsClearingData(true);
    try {
      if (window.electron?.clearAppData) {
        const result = await window.electron.clearAppData();
        if (result.success) {
          // 清除 localStorage
          localStorage.clear();
          if (window.electron.showNotification) {
            window.electron.showNotification(t('settings.clearData'), t('settings.clearDataSuccess'));
          }
          // 刷新页面
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          if (window.electron.showNotification) {
            window.electron.showNotification(t('settings.clearData'), result.error || t('common.error'));
          }
        }
      }
    } catch (e: any) {
      if (window.electron.showNotification) {
        window.electron.showNotification(t('settings.clearData'), e.message || t('common.error'));
      }
    } finally {
      setIsClearingData(false);
      setShowClearDataConfirm(false);
    }
  };



  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-6 h-full overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-xl font-bold text-white mb-6 px-1">{t('settings.title')}</h2>

      <div className="space-y-3 pb-8">
        {/* WakaTime 设置 */}
        <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700 hover:border-dark-600 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-white font-semibold text-sm">{t('settings.wakatimeTitle')}</h3>
              <p className="text-slate-400 text-xs mt-0.5">
                {t('settings.wakatimeDescription')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={wakatimeKey}
              onChange={(e) => setWakatimeKey(e.target.value)}
              placeholder="waka_..."
              className="flex-1 bg-dark-900 border border-dark-600 rounded-lg px-3 py-1.5 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              onClick={handleSaveWakaTime}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${showSaveSuccess
                ? 'bg-green-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                }`}
            >
              {showSaveSuccess ? t('settings.saved') : t('common.save')}
            </button>
          </div>

          {showConfigSynced && (
            <div className="mt-2 text-[10px] text-green-500 font-medium animate-in fade-in slide-in-from-top-1 px-1">
              ✓ {t('settings.configSynced')}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-dark-700/50">
            <div className="mb-2">
              <h3 className="text-white font-semibold text-sm">{t('settings.wakatimeUrlTitle')}</h3>
              <p className="text-slate-400 text-xs mt-0.5">
                {t('settings.wakatimeUrlDescription')}
              </p>
            </div>
            <input
              type="text"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://wakatime.com"
              className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-1.5 text-slate-200 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* 插件安装 */}
        <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700 hover:border-dark-600 transition-colors group">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500/20 transition-colors">
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">{t('settings.installPlugin')}</h3>
                <p className="text-slate-400 text-xs">VS Code, IntelliJ, Chrome, etc.</p>
              </div>
            </div>
            <button
              onClick={handleInstallPlugin}
              className="p-1.5 rounded-lg bg-dark-700 text-slate-200 hover:bg-dark-600 hover:text-white transition-all transform group-hover:translate-x-1"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

          <button
            onClick={handleInstallVSCode}
            disabled={isInstalling}
            className={`w-full py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${isInstalling
              ? 'bg-dark-700 text-slate-500 cursor-not-allowed'
              : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/20'
              }`}
          >
            {isInstalling ? (
              <>
                <svg className="animate-spin size-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('settings.autoInstalling')}
              </>
            ) : (
              <>
                <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.15 2.587L18.21.21a1.494 1.494 0 00-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 00-1.276.057L.327 7.261a1 1 0 00-.029 1.436L9.25 17.629l.006.007c.362.362.951.363 1.314.004l12.8-13.731a1 1 0 00-.22-1.322zM10 16.208l-7.394-7.4 1.15-.97 3.53 2.68a1 1 0 001.373-.105l9.156-8.352 2.768 1.325L10 16.208z" />
                </svg>
                {t('settings.installVSCode')}
              </>
            )}
          </button>
        </div>



        {/* 语言设置 */}
        <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700 hover:border-dark-600 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm">{t('settings.language')}</h3>
              <p className="text-slate-400 text-xs mt-0.5">{t('settings.languageDescription')}</p>
            </div>
            <LanguageSwitcher />
          </div>
        </div>

        {/* 通知设置 */}
        <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700 hover:border-dark-600 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm">{t('settings.notifications')}</h3>
              <p className="text-slate-400 text-xs mt-0.5">{t('settings.notificationsDescription')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-300 text-xs font-medium">{notificationsEnabled ? 'On' : 'Off'}</span>
              <button
                onClick={toggleNotifications}
                className={`w-10 h-5 rounded-full relative transition-all duration-300 ${notificationsEnabled ? 'bg-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-dark-700'
                  }`}
              >
                <div
                  className={`size-4 bg-white rounded-full absolute top-0.5 transition-transform duration-300 ${notificationsEnabled ? 'translate-x-[1.25rem]' : 'translate-x-0.5'
                    }`}
                ></div>
              </button>
            </div>
          </div>
        </div>

        {/* 时钟设置 */}
        <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700 hover:border-dark-600 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm">{t('settings.clock')}</h3>
              <p className="text-slate-400 text-xs mt-0.5">{t('settings.clockDescription')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-300 text-xs font-medium">{showSeconds ? 'On' : 'Off'}</span>
              <button
                onClick={toggleShowSeconds}
                className={`w-10 h-5 rounded-full relative transition-all duration-300 ${showSeconds ? 'bg-emerald-500 shadow-md shadow-emerald-500/20' : 'bg-dark-700'
                  }`}
              >
                <div
                  className={`size-4 bg-white rounded-full absolute top-0.5 transition-transform duration-300 ${showSeconds ? 'translate-x-[1.25rem]' : 'translate-x-0.5'
                    }`}
                ></div>
              </button>
            </div>
          </div>
        </div>

        {/* 关于 */}
        <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700 hover:border-dark-600 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm">{t('settings.about')}</h3>
              <p className="text-slate-400 text-xs mt-0.5">{t('settings.version')}: 1.0.0</p>
            </div>
          </div>
        </div>

        {/* 危险区域 */}
        <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/30 hover:border-red-500/50 transition-colors space-y-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-red-400 font-semibold text-sm">{t('settings.dangerZone')}</h3>
              <p className="text-slate-400 text-xs">{t('settings.dangerZoneDescription')}</p>
            </div>
          </div>

          {/* 清除数据按钮 */}
          <div className="border-t border-red-500/20 pt-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-white font-medium text-sm">{t('settings.clearData')}</h4>
                <p className="text-slate-400 text-xs">{t('settings.clearDataDescription')}</p>
              </div>
            </div>
            
            {!showClearDataConfirm ? (
              <button
                onClick={() => setShowClearDataConfirm(true)}
                disabled={isClearingData}
                className="w-full py-2 rounded-lg text-sm font-bold bg-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white border border-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('settings.clearData')}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-orange-400 text-xs font-medium">{t('settings.clearDataConfirm')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearData}
                    disabled={isClearingData}
                    className="flex-1 py-1.5 rounded-lg text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClearingData ? (
                      <span className="flex items-center justify-center gap-1">
                        <svg className="animate-spin size-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {t('settings.clearing')}
                      </span>
                    ) : (
                      t('common.confirm')
                    )}
                  </button>
                  <button
                    onClick={() => setShowClearDataConfirm(false)}
                    disabled={isClearingData}
                    className="flex-1 py-1.5 rounded-lg text-sm font-bold bg-dark-700 text-slate-300 hover:bg-dark-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 卸载按钮 */}
          <div className="border-t border-red-500/20 pt-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-white font-medium text-sm">{t('settings.uninstall')}</h4>
                <p className="text-slate-400 text-xs">{t('settings.uninstallDescription')}</p>
              </div>
            </div>
            
            {!showUninstallConfirm ? (
              <button
                onClick={() => setShowUninstallConfirm(true)}
                disabled={isUninstalling}
                className="w-full py-2 rounded-lg text-sm font-bold bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('settings.uninstall')}
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-red-400 text-xs font-medium">{t('settings.uninstallConfirm')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleUninstall}
                    disabled={isUninstalling}
                    className="flex-1 py-1.5 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUninstalling ? (
                      <span className="flex items-center justify-center gap-1">
                        <svg className="animate-spin size-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        {t('settings.uninstalling')}
                      </span>
                    ) : (
                      t('common.confirm')
                    )}
                  </button>
                  <button
                    onClick={() => setShowUninstallConfirm(false)}
                    disabled={isUninstalling}
                    className="flex-1 py-1.5 rounded-lg text-sm font-bold bg-dark-700 text-slate-300 hover:bg-dark-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const HomeView: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] w-full max-w-5xl mx-auto px-6 animate-in fade-in duration-700 text-center">
      <div className="space-y-8 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/40 border border-slate-700 text-sm font-medium text-slate-300">
          {t('home.productBadge')}
        </div>
        <div className="space-y-2">
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight">
            {t('home.heroTitle')}
          </h1>
          <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-slate-400 to-slate-800 leading-tight pb-2">
            {t('home.heroSubtitle')}
          </h1>
        </div>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          {t('home.description')}
        </p>
      </div>
    </div>
  );
};


// --- Main App Component ---

const AppContent: React.FC = () => {
  const { t } = useI18n();
  const [currentView, setCurrentView] = useState<'timer' | 'stats' | 'settings' | 'codetime' | 'codetyping'>('timer');
  const [activeTimerTab, setActiveTimerTab] = useState<'pomodoro' | 'countdown' | 'todo'>('pomodoro');
  const { themeColor } = useTheme();


  // --- 关键状态恢复 ---
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMES[TimerMode.WORK]);
  const [timerMode, setTimerMode] = useState<TimerMode>(TimerMode.WORK);
  const [isActive, setIsActive] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [countdownTime, setCountdownTime] = useState(1800);
  const [countdownInput, setCountdownInput] = useState(30);
  const [countdownInputHours, setCountdownInputHours] = useState(0);
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownTimeLeft, setCountdownTimeLeft] = useState(1800);
  const [countdownStartTime, setCountdownStartTime] = useState<Date | null>(null);
  const [showSeconds, setShowSeconds] = useState(() => localStorage.getItem('show_seconds') === 'true');
  const [pomodoroStartTime, setPomodoroStartTime] = useState<Date | null>(null);
  const [zenMode, setZenMode] = useState(false);

  useEffect(() => {
    localStorage.setItem('show_seconds', String(showSeconds));
  }, [showSeconds]);


  // ... (previous useEffects) ...





  const audioContextRef = useRef<AudioContext | null>(null);

  // 获取统计数据
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const userStats = await getUserStats();
      setStats(userStats);
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setStats({
        todayFocus: 0,
        weeklyTotal: 0,
        streak: 0,
        totalFocusTime: 0
      });
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatTotalMinutes = (minutes: number) => {
    const days = Math.floor(minutes / (60 * 24));
    const hours = Math.floor((minutes % (60 * 24)) / 60);
    const mins = minutes % 60;

    let result = '';
    if (days > 0) result += `${days}d`;
    if (hours > 0) result += `${hours}h`;
    if (mins > 0 || result === '') result += `${mins}m`;

    return result;
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearInterval(clockInterval);
    };
  }, []);

  const playNotification = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }, []);

  const saveSession = useCallback(async () => {
    if (sessionStartTime) {
      const duration = Math.floor((new Date().getTime() - sessionStartTime.getTime()) / 1000);
      const startedAt = sessionStartTime.toISOString();

      try {
        await saveSessionData(duration, startedAt);
        await fetchStats(); // 保存后立即刷新统计
      } catch (error) {
        console.error('保存会话数据失败:', error);
      }

      setSessionStartTime(null);
    }
  }, [sessionStartTime, fetchStats]);

  const toggleTimer = useCallback(() => {
    if (!isActive) {
      setSessionStartTime(new Date());
    } else {
      // 暂停时保存当前阶段进度
      saveSession();
    }

    setIsActive(!isActive);
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }, [isActive, saveSession]);

  const resetTimer = useCallback(() => {
    setIsActive(false);
    setTimeLeft(DEFAULT_TIMES[TimerMode.WORK]);
    setSessionStartTime(null);
  }, []);

  const addTime = () => {
    setTimeLeft(prev => prev + 5 * 60);
  };

  const toggleZenMode = async () => {
    const nextZenMode = !zenMode;
    if (window.electron?.setZenMode) {
      const result = await window.electron.setZenMode(nextZenMode);
      if (result.success) {
        setZenMode(nextZenMode);
      }
    } else {
      // 非 Electron 环境仅切换 UI 状态
      setZenMode(nextZenMode);
    }
  };

  // 自动计时逻辑：进入任意计时标签页且不在倒计时状态时，开启后台番茄钟统计
  useEffect(() => {
    let interval: number | null = null;

    if (currentView === 'timer' && activeTimerTab === 'pomodoro') {
      if (!pomodoroStartTime) {
        setPomodoroStartTime(new Date());
      }

      interval = window.setInterval(() => {
        // 后台累加统计（模拟番茄钟行为，但 UI 保持时钟样式）
      }, 1000);
    } else {
      // 离开“时间”页面时保存增量
      if (pomodoroStartTime) {
        const duration = Math.floor((new Date().getTime() - pomodoroStartTime.getTime()) / 1000);
        const startedAt = pomodoroStartTime.toISOString();
        if (duration > 0) {
          saveSessionData(duration, startedAt)
            .then(() => fetchStats())
            .catch(err => console.error('保存时间页面统计失败:', err));
        }
        setPomodoroStartTime(null);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentView, activeTimerTab, pomodoroStartTime, fetchStats]);


  const handleTaskChange = useCallback(async (newTasks: Task[]) => {
    setTasks(newTasks);

    for (const task of newTasks) {
      try {
        await saveTaskData(task.id, task.text, task.completed);
      } catch (error) {
        console.error('保存任务数据失败:', error);
      }
    }
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatRealTime = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      ...(showSeconds ? { second: '2-digit' } : {})
    };
    return date.toLocaleTimeString('en-US', options);
  };

  const formatDate = (date: Date) => {
    const dateStr = date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
    const weekStr = date.toLocaleDateString('zh-CN', { weekday: 'long' });
    return `${dateStr} ${weekStr}`;
  };

  const formatTimezoneInfo = () => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const parts = timeZone.split('/');
      const city = parts[parts.length - 1].replace(/_/g, ' ');
      const country = new Intl.DisplayNames(['en'], { type: 'region' }).of(
        new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone.split('/')[0] === 'Asia' ? 'CN' : 'US'
      ); // 这是一个简化的启发式方案，真实情况建议组合显示

      // 更通用的方案：直接显示时区 ID 和 偏移量名称
      const tzName = new Intl.DateTimeFormat('en-US', { timeZoneName: 'long' }).format(new Date()).split(', ')[1];
      return `${city}, ${tzName}`;
    } catch (e) {
      return 'UTC';
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable fullscreen mode: ${e.message} (${e.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Timer Effect
  useEffect(() => {
    let interval: number | null = null;
    if (isActive && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      playNotification();

      // 显示系统通知
      const notificationsEnabled = localStorage.getItem('notifications_enabled') === 'true';
      if (notificationsEnabled && window.electron && window.electron.showNotification) {
        window.electron.showNotification(
          '番茄钟完成',
          '恭喜,你已完成一个番茄钟,休息一下吧'
        );
      }
    }
    document.title = isActive ? `${formatTime(timeLeft)} - Orbit Focus` : 'Orbit Focus';
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, timeLeft, playNotification]);

  // Countdown Timer Effect
  useEffect(() => {
    let interval: number | null = null;
    if (countdownActive && countdownTimeLeft > 0) {
      interval = window.setInterval(() => {
        setCountdownTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (countdownTimeLeft === 0 && countdownStartTime) {
      setCountdownActive(false);
      playNotification();

      // 保存倒计时会话数据到统计
      const duration = countdownTime; // 使用设定的总时长
      const startedAt = countdownStartTime.toISOString();
      saveSessionData(duration, startedAt)
        .then(() => fetchStats()) // 保存后刷新统计
        .catch(err => console.error('保存倒计时会话失败:', err));
      setCountdownStartTime(null);

      // 显示系统通知
      const notificationsEnabled = localStorage.getItem('notifications_enabled') === 'true';
      if (notificationsEnabled && window.electron && window.electron.showNotification) {
        window.electron.showNotification(
          '倒计时完成',
          `恭喜完成 ${Math.floor(countdownTime / 60)} 分钟专注！`
        );
      }
    }
    return () => { if (interval) clearInterval(interval); };
  }, [countdownActive, countdownTimeLeft, countdownStartTime, countdownTime, playNotification]);



  const calculateProgress = () => {
    const base = Math.max(DEFAULT_TIMES[TimerMode.WORK], timeLeft);
    return timeLeft > 0 ? ((base - timeLeft) / base) * 100 : 100;
  };


  return (
    <div className="h-screen bg-[#0B0C15] text-slate-200 font-sans flex flex-col overflow-hidden">
      <TitleBar />
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* 侧边导航栏 */}
        <nav className={`absolute left-0 top-0 z-50 w-40 h-full transition-all duration-300 flex flex-col ${isFullscreen ? '-translate-x-full' : 'translate-x-0 bg-[#0B0C15]/80 backdrop-blur-md border-r border-dark-700'}`}>
          {/* Logo - 已移至标题栏，此处移除或显示简化版 */}
          <div className="flex items-center gap-2 px-6 py-6 border-b border-dark-700 md:hidden">
            <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
            <h1 className="font-bold tracking-wider text-sm text-slate-200">ORBIT FOCUS</h1>
          </div>

          {/* 导航按钮 - 添加 padding-bottom 防止被底部绝对定位元素遮挡 */}
          <div className="flex-1 flex flex-col gap-2 p-4 pb-20">
            {[
              { id: 'timer', label: t('navigation.timer') },
              { id: 'codetime', label: 'Code Time' },
              { id: 'codetyping', label: t('navigation.codeTyping') },
              { id: 'stats', label: t('navigation.stats') }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id as any)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${currentView === item.id
                  ? 'bg-dark-700 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-dark-800/50'
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>


          {/* 设置按钮固定在底部 */}
          <div className="absolute bottom-0 left-0 w-full p-4 border-t border-dark-700 bg-[#0B0C15]/95 backdrop-blur-sm">
            <button
              onClick={() => setCurrentView('settings')}
              className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${currentView === 'settings'
                ? 'bg-dark-700 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-300 hover:bg-dark-800/50'
                }`}
            >
              {t('navigation.settings')}
            </button>
          </div>
        </nav>

        {/* 主内容区 */}
        <main className={`flex-1 w-full flex flex-col relative overflow-hidden transition-all duration-300 ${isFullscreen ? 'ml-0' : 'ml-40'}`}>
          {currentView === 'stats' && (
            <div>
              <StatsView />
            </div>
          )}

          {currentView === 'codetime' && <CodeTimeView />}
          {currentView === 'codetyping' && <CodeTypingView />}
          {currentView === 'settings' && (
            <SettingsView
              showSeconds={showSeconds}
              toggleShowSeconds={() => setShowSeconds(!showSeconds)}
            />
          )}
          <div
            className={`flex-1 flex flex-col items-center justify-center animate-in fade-in duration-300 relative ${currentView === 'timer' ? 'flex' : 'hidden'}`}
          >
            <div className="absolute top-6 left-6 z-20 hidden md:flex items-center gap-3 group">
              <button
                onClick={toggleFullscreen}
                className="p-2 text-slate-500 hover:text-slate-200 bg-dark-800/50 hover:bg-dark-700 rounded-lg transition-all border border-transparent hover:border-dark-600"
                title={isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen (F11)"}
              >
                {isFullscreen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5-5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
              <span className="text-xs font-medium text-slate-500 bg-dark-800/80 px-3 py-1.5 rounded-full border border-dark-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-help select-none whitespace-nowrap">
                {isFullscreen ? 'Press Esc to exit fullscreen' : 'Press F11 for Fullscreen'}
              </span>
            </div>

            {/* 标签栏 - 绝对定位到顶部 */}
            <div className={`absolute top-8 left-1/2 -translate-x-1/2 z-10 ${currentView === 'timer' ? 'block' : 'hidden'}`}>
              <div className="flex items-center gap-4">
                <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-full p-1.5 flex items-center gap-1 shadow-2xl">
                  {(['pomodoro', 'countdown', 'todo'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTimerTab(tab)}
                      className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${activeTimerTab === tab
                        ? (zenMode ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-800 text-white shadow-lg shadow-rose-900/20')
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                      {t(`timer.tabs.${tab}`)}
                    </button>
                  ))}
                </div>

                {/* 禅静模式切换按钮 */}
                <button
                  onClick={toggleZenMode}
                  title={zenMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold transition-all duration-500 shadow-xl relative group ${zenMode
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                    : 'bg-slate-800/80 backdrop-blur-md border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-500 hover:bg-rose-800/20'
                    }`}
                >
                  禅
                </button>
              </div>
            </div>

            {/* 主内容 - 完全居中 */}
            <div className={`w-full h-full flex items-center justify-center ${currentView === 'timer' ? 'flex' : 'hidden'}`}>
              {activeTimerTab === 'pomodoro' && (
                <div className="flex flex-col items-center justify-center animate-in fade-in duration-500 mb-16">
                  <div className="flex flex-col items-center">
                    {/* Time Display - Only Clock */}
                    <div className="text-7xl md:text-[8rem] lg:text-[10rem] font-bold font-mono tracking-tighter text-white drop-shadow-2xl">
                      {formatRealTime(currentTime)}
                    </div>
                    <div className="text-slate-400 text-lg md:text-xl mt-4 font-medium tracking-wide uppercase">
                      {formatDate(currentTime)}
                    </div>
                    <div className="text-slate-500 text-sm md:text-base mt-2 font-mono opacity-80">
                      {formatTimezoneInfo()}
                    </div>
                  </div>
                </div>
              )}

              {activeTimerTab === 'countdown' && (
                <div className="flex flex-col items-center w-full animate-in fade-in duration-500 mt-16 text-center">
                  <div className="mb-12 relative w-72 h-72 md:w-[24rem] md:h-[24rem] lg:w-[31rem] lg:h-[31rem] flex items-center justify-center">
                    {/* Background Ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-dark-700 opacity-30"></div>

                    {/* Progress Ring */}
                    <svg className="w-full h-full rotate-90 transform">
                      <circle
                        cx="50%"
                        cy="50%"
                        r="48%"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className={`${zenMode ? 'text-emerald-500' : 'text-rose-800'} transition-all duration-1000 ease-linear`}
                        strokeDasharray={`${2 * Math.PI * 48}%`}
                        strokeDashoffset={`${2 * Math.PI * 48 * (1 - countdownTimeLeft / countdownTime)}%`}
                        strokeLinecap="round"
                      />
                    </svg>

                    {/* Time Display */}
                    <div className="absolute flex flex-col items-center">
                      <div className="text-6xl md:text-[7rem] lg:text-[8rem] font-bold font-mono tracking-tighter text-white">
                        {formatTime(countdownTimeLeft)}
                      </div>
                      <div className="text-slate-400 text-sm md:text-lg mt-3 font-medium tracking-wide">
                        {countdownActive ? 'RUNNING' : 'PAUSED'}
                      </div>
                    </div>

                    {/* Right Side Input */}
                    {!countdownActive && (
                      <div className="absolute -right-28 md:-right-40 lg:-right-56 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 bg-[#0B0C15] p-4 rounded-xl border border-slate-700 shadow-xl">
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">SET TIME</span>
                        <div className="flex items-center gap-2">
                          {/* Hour Input */}
                          <div className="flex items-baseline gap-1">
                            <input
                              type="number"
                              min="0"
                              max="23"
                              value={countdownInputHours}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 0) {
                                  setCountdownInputHours(val);
                                  const totalSeconds = (val * 3600) + (countdownInput * 60);
                                  setCountdownTime(totalSeconds);
                                  setCountdownTimeLeft(totalSeconds);
                                }
                              }}
                              className="w-12 bg-transparent text-white text-3xl font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-b border-white/10 focus:border-emerald-500 transition-colors pb-1"
                            />
                            <span className="text-slate-500 text-xs font-medium">h</span>
                          </div>

                          {/* Minute Input */}
                          <div className="flex items-baseline gap-1">
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={countdownInput}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 0) {
                                  setCountdownInput(val);
                                  const totalSeconds = (countdownInputHours * 3600) + (val * 60);
                                  setCountdownTime(totalSeconds);
                                  setCountdownTimeLeft(totalSeconds);
                                }
                              }}
                              className="w-16 bg-transparent text-white text-3xl font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-b border-white/10 focus:border-emerald-500 transition-colors pb-1"
                            />
                            <span className="text-slate-500 text-xs font-medium">min</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-8">
                    <button
                      onClick={() => {
                        if (!countdownActive && countdownTimeLeft > 0) {
                          // 开始计时：记录开始时间
                          setCountdownStartTime(new Date());
                        } else if (countdownActive && countdownStartTime) {
                          // 暂停计时：保存增量时长到统计
                          const duration = Math.floor((new Date().getTime() - countdownStartTime.getTime()) / 1000);
                          const startedAt = countdownStartTime.toISOString();
                          if (duration > 0) {
                            saveSessionData(duration, startedAt)
                              .then(() => fetchStats())
                              .catch(err => console.error('保存倒计时增量失败:', err));
                          }
                          setCountdownStartTime(null);
                        }
                        setCountdownActive(!countdownActive);
                      }}
                      className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95 ${countdownActive
                        ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 ring-1 ring-amber-500/50'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20'
                        }`}
                    >
                      {countdownActive ? (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg> // Pause icon
                      ) : (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      )}
                    </button>

                    <button
                      aria-label="Reset Timer"
                      onClick={() => {
                        setCountdownActive(false);
                        // Smart Reset: If already reset to configured time, reset to default 30m
                        if (countdownTimeLeft === countdownTime) {
                          setCountdownTime(1800);
                          setCountdownTimeLeft(1800);
                          setCountdownInput(30);
                          setCountdownInputHours(0);
                        } else {
                          // Otherwise reset to current configuration
                          setCountdownTimeLeft(countdownTime);
                        }
                      }}
                      className="w-16 h-16 rounded-full bg-dark-700 text-slate-300 flex items-center justify-center hover:bg-dark-600 hover:text-white transition-all hover:rotate-180 active:scale-95 duration-500 shadow-lg"
                    >
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {activeTimerTab === 'todo' && (
                <div className="w-full max-w-4xl mx-auto">
                  <div className="w-full bg-transparent overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 250px)' }}>
                    <TaskList tasks={tasks} setTasks={handleTaskChange} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div >
    </div >
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}