import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TimerMode, Task, SessionStatsResponse, CalendarMonth, CalendarDay, HeatmapRow, StreakData } from './types';
import { DEFAULT_TIMES } from './constants';
import { TaskList } from './components/TaskList';
import { Logo } from './components/Logo';
import { useI18n, LanguageSwitcher, Language } from './contexts/I18nContext';
import { getUserStats } from './services/apiService';
import { saveSessionData, saveTaskData } from './services/dataSyncService';

// --- View Components ---

const HomeView: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] w-full max-w-5xl mx-auto px-6 animate-in fade-in duration-700 text-center">
      <div className="space-y-8 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gh-surface/40 border border-gh-border text-sm font-medium text-gh-fg">
          {t('home.productBadge')}
        </div>
        <div className="space-y-2">
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight">
            {t('home.heroTitle')}
          </h1>
          <h1 className="text-5xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-gh-muted to-gh-surface leading-tight pb-2">
            {t('home.heroSubtitle')}
          </h1>
        </div>
        <p className="text-lg text-gh-muted]<]minimax[>[ max-w-2xl mx-auto leading-relaxed">
          {t('home.description')}
        </p>
      </div>
    </div>
  );
};

const StatsView: React.FC = () => {
  const { t, language } = useI18n();
  const [stats, setStats] = useState<SessionStatsResponse | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const userStats = await getUserStats();
        setStats(userStats);
      } catch (error) {
        console.error('获取统计数据失败:', error);
        // 设置默认数据
        setStats({
          todayFocus: 0,
          weeklyTotal: 0,
          weeklyData: Array(7).fill(0),
          heatmapData: [],
          totalDuration: 0,
          streak: {
            current: 0,
            max: 0,
            totalDays: 0
          }
        });
      }
    };

    fetchStats();
  }, []);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getLast7DaysLabels = () => {
    const labels = [];
    const today = new Date();
    let locale = 'en-US';
    if (language === 'zh') locale = 'zh-CN';
    if (language === 'ru') locale = 'ru-RU';

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dayName = date.toLocaleDateString(locale, { weekday: 'short' });
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
      labels.push(`${dayName} ${dateStr}`);
    }

    return labels;
  };

  const generateStudyCalendar = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const months = [];
    const heatmapData = stats?.heatmapData || [];
    const heatmapMap = new Map();

    heatmapData.forEach((day: HeatmapRow) => {
      heatmapMap.set(day.date, {
        work_time: day.work_time || 0
      });
    });

    const monthNames: Record<Language, string[]> = {
      en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
      ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
    };

    const validLanguage = (language && monthNames[language]) ? language : 'en';

    for (let month = 0; month < 12; month++) {
      const monthData: CalendarMonth = {
        monthIndex: month,
        monthName: monthNames[validLanguage][month],
        weeks: []
      };

      const firstDay = new Date(currentYear, month, 1);
      const lastDay = new Date(currentYear, month + 1, 0);
      const weeks: CalendarDay[][] = [];
      let currentWeek: CalendarDay[] = [];

      const firstDayOfWeek = firstDay.getDay();
      for (let i = 0; i < firstDayOfWeek; i++) {
        currentWeek.push({ date: null, activityLevel: 0, isEmpty: true });
      }

      const currentDate = new Date(firstDay);

      while (currentDate <= lastDay) {
        // 使用本地日期格式 YYYY-MM-DD
        const year = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${m}-${d}`;

        let activityLevel = 0;
        const dayData = heatmapMap.get(dateStr);
        const workTime = dayData?.work_time || 0;

        if (workTime > 0) {
          if (workTime < 1800) activityLevel = 1;
          else if (workTime < 3600) activityLevel = 2;
          else if (workTime < 7200) activityLevel = 3;
          else activityLevel = 4;
        }

        currentWeek.push({
          date: dateStr,
          activityLevel,
          isEmpty: false,
          workTime
        });

        if (currentDate.getDay() === 6) {
          weeks.push(currentWeek);
          currentWeek = [];
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
          currentWeek.push({ date: null, activityLevel: 0, isEmpty: true });
        }
        weeks.push(currentWeek);
      }

      monthData.weeks = weeks.slice(0, 5);
      months.push(monthData);
    }

    return months;
  };

  const studyStats = stats?.streak || {
    current: 0,
    max: 0,
    totalDays: 0
  };

  let studyCalendar: CalendarMonth[] = [];
  let dayLabels: string[] = [];
  try {
    studyCalendar = generateStudyCalendar();
    dayLabels = getLast7DaysLabels();
  } catch (error) {
    console.error('生成统计数据失败:', error);
  }

  const weeklyData = stats?.weeklyData || Array(7).fill(0);
  const maxVal = Math.max(...weeklyData, 30);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-baseline justify-between pb-2">
            <h2 className="text-lg font-semibold text-gh-fg tracking-tight">{t('stats.title')}</h2>
            <div className="text-xs text-gh-subtle font-mono">{new Date().getFullYear()}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border-t border-l border-gh-border rounded-lg overflow-hidden">
            <div className="p-5 border-r border-b border-gh-border">
              <h3 className="text-gh-muted text-[11px] mb-3 uppercase tracking-wider font-semibold">{t('stats.todayFocus')}</h3>
              <div className="text-2xl text-gh-fg font-mono font-medium">{formatMinutes(stats?.todayFocus || 0)}</div>
            </div>
            <div className="p-5 border-r border-b border-gh-border">
              <h3 className="text-gh-muted text-[11px] mb-3 uppercase tracking-wider font-semibold">{t('stats.weeklyTotal')}</h3>
              <div className="text-2xl text-gh-fg font-mono font-medium">{formatMinutes(stats?.weeklyTotal || 0)}</div>
            </div>
            <div className="p-5 border-r border-b border-gh-border">
              <h3 className="text-gh-muted text-[11px] mb-3 uppercase tracking-wider font-semibold">{t('stats.streak')}</h3>
              <div className="text-2xl text-gh-danger font-mono font-medium">{studyStats.current || 0} {t('stats.days')}</div>
            </div>
            <div className="p-5 border-r border-b border-gh-border">
              <h3 className="text-gh-muted text-[11px] mb-3 uppercase tracking-wider font-semibold">{t('stats.totalTime')}</h3>
              <div className="text-2xl text-gh-fg font-mono font-medium">{formatMinutes(stats?.totalDuration || 0)}</div>
            </div>
          </div>

          <div className="border border-gh-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gh-border">
              <h3 className="text-gh-fg font-medium text-sm">{t('stats.last7Days')}</h3>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gh-success-emph rounded-sm"></div>
                <span className="text-xs text-gh-muted">{t('stats.yourFocusTime')}</span>
              </div>
            </div>

            <div className="relative px-5 py-6">
              <div className="flex items-end h-48 gap-3 relative" style={{ paddingLeft: '50px' }}>
                <div className="absolute left-12 top-0 bottom-0 w-px bg-gh-border-muted"></div>
                <div className="absolute left-12 right-0 h-px bg-gh-border-muted" style={{ bottom: '0%' }}></div>
                <div className="absolute left-12 right-0 h-px bg-gh-border-muted" style={{ bottom: '50%' }}></div>
                <div className="absolute left-12 right-0 h-px bg-gh-border-muted" style={{ bottom: '100%' }}></div>

                {dayLabels.map((day, i) => {
                  const val = weeklyData[i] || 0;
                  const heightPercent = val > 0 ? Math.max((val / maxVal) * 100, 4) : 0;

                  return (
                    <div key={`${day}-${i}`} className="flex flex-col items-center flex-1 group relative h-full">
                      <div className="w-full h-full relative flex items-end justify-center">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[32px] rounded-t-sm transition-all duration-500 ${val > 0 ? 'bg-gh-success-emph group-hover:bg-gh-success' : 'bg-transparent'
                            }`}
                        >
                          {val > 0 && (
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gh-surface text-gh-fg text-[10px] px-2 py-1 rounded border border-gh-border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-xl font-mono">
                              {val} 分钟
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="absolute left-5 top-6 h-48 flex flex-col justify-between text-[10px] text-gh-muted font-mono" style={{ width: '40px' }}>
                <div className="text-right pr-2">{Math.round(maxVal)}m</div>
                <div className="text-right pr-2">{Math.round(maxVal / 2)}m</div>
                <div className="text-right pr-2">0m</div>
              </div>

              <div className="flex mt-3" style={{ marginLeft: '50px' }}>
                <div className="flex flex-1 gap-2">
                  {dayLabels.map((day, index) => (
                    <div key={index} className="text-[10px] text-gh-muted px-1 flex-1 text-center font-mono">
                      {day}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gh-border rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-gh-border">
              <div className="flex justify-between items-start">
                <div className="flex gap-10">
                  <div className="min-w-[90px]">
                    <div className="text-[11px] text-gh-muted mb-1.5 uppercase tracking-wider font-semibold">{t('stats.currentStreak')}</div>
                    <div className="text-2xl font-mono font-medium text-gh-fg">{studyStats.current} {t('stats.days')}</div>
                  </div>
                  <div className="min-w-[90px]">
                    <div className="text-[11px] text-gh-muted mb-1.5 uppercase tracking-wider font-semibold">{t('stats.maxStreak')}</div>
                    <div className="text-2xl font-mono font-medium text-gh-fg">{studyStats.max} {t('stats.days')}</div>
                  </div>
                  <div className="min-w-[90px]">
                    <div className="text-[11px] text-gh-muted mb-1.5 uppercase tracking-wider font-semibold">{t('stats.totalDays')}</div>
                    <div className="text-2xl font-mono font-medium text-gh-success">{studyStats.totalDays} {t('stats.days')}</div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 text-xs text-gh-muted">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span>{t('stats.less')}</span>
                    <div className="w-2.5 h-2.5 bg-gh-border-muted rounded-sm"></div>
                    <div className="w-2.5 h-2.5 bg-gh-success-emph/30 rounded-sm"></div>
                    <div className="w-2.5 h-2.5 bg-gh-success-emph/50 rounded-sm"></div>
                    <div className="w-2.5 h-2.5 bg-gh-success-emph/80 rounded-sm"></div>
                    <div className="w-2.5 h-2.5 bg-gh-success-emph rounded-sm"></div>
                    <span>{t('stats.more')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full overflow-x-auto px-5 py-5">
              <div className="inline-flex gap-2 pb-2">
                {studyCalendar.map((monthData, monthIndex) => (
                  <div key={monthIndex} className="flex flex-col items-center min-w-[60px]">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {(monthData.weeks || []).flat().map((day, dayIndex) => (
                        <div
                          key={dayIndex}
                          className={`w-2 h-2 rounded-sm ${day.isEmpty ? 'bg-transparent' :
                            day.activityLevel === 0 ? 'bg-gh-border-muted' :
                              day.activityLevel === 1 ? 'bg-gh-success-emph/30' :
                                day.activityLevel === 2 ? 'bg-gh-success-emph/50' :
                                  day.activityLevel === 3 ? 'bg-gh-success-emph/80' :
                                    'bg-gh-success-emph'
                            }`}
                          title={day.date ? `${day.date}: ${Math.round(day.workTime / 60)}${t('heatmap.minutes')}` : t('heatmap.noData')}
                        ></div>
                      ))}
                    </div>
                    <div className="text-[10px] text-gh-muted font-mono font-medium">
                      {monthData.monthName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

const AppContent: React.FC = () => {
  const { t, language } = useI18n();
  const [currentView, setCurrentView] = useState<'home' | 'timer' | 'stats'>('home');
  const [activeTimerTab, setActiveTimerTab] = useState<'pomodoro' | 'countdown' | 'todo'>('pomodoro');

  // Timer State
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIMES[TimerMode.WORK]);
  const [isActive, setIsActive] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Clock State
  const [currentTime, setCurrentTime] = useState(new Date());

  // Stats State
  const [stats, setStats] = useState<SessionStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Countdown State
  const [countdownTime, setCountdownTime] = useState(1800);
  const [countdownInput, setCountdownInput] = useState(30);
  const [countdownInputHours, setCountdownInputHours] = useState(0);
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownTimeLeft, setCountdownTimeLeft] = useState(1800);
  const [countdownStartTime, setCountdownStartTime] = useState<Date | null>(null);

  // Zen Mode
  const [zenMode, setZenMode] = useState(false);

  // Pomodoro start time for background tracking
  const [pomodoroStartTime, setPomodoroStartTime] = useState<Date | null>(null);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        await fetchStats();
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
      saveSession();
    }

    setIsActive(!isActive);
    if (!audioContextRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const toggleZenMode = () => {
    setZenMode(!zenMode);
  };

  // 自动计时逻辑：进入番茄标签页时开启后台统计
  useEffect(() => {
    let interval: number | null = null;

    if (currentView === 'timer' && activeTimerTab === 'pomodoro') {
      if (!pomodoroStartTime) {
        setPomodoroStartTime(new Date());
      }

      interval = window.setInterval(() => {
        // 后台累加统计
      }, 1000);
    } else {
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
      second: '2-digit',
    };
    return date.toLocaleTimeString('en-US', options);
  };

  const formatDate = (date: Date) => {
    let locale = 'en-US';
    if (language === 'zh') locale = 'zh-CN';
    if (language === 'ru') locale = 'ru-RU';
    
    const dateStr = date.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.');
    const weekStr = date.toLocaleDateString(locale, { weekday: 'long' });
    return `${dateStr} ${weekStr}`;
  };

  const formatTimezoneInfo = () => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const parts = timeZone.split('/');
      const city = parts[parts.length - 1].replace(/_/g, ' ');
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

      const duration = countdownTime;
      const startedAt = countdownStartTime.toISOString();
      saveSessionData(duration, startedAt)
        .then(() => fetchStats())
        .catch(err => console.error('保存倒计时会话失败:', err));
      setCountdownStartTime(null);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [countdownActive, countdownTimeLeft, countdownStartTime, countdownTime, playNotification, fetchStats]);

  const calculateProgress = () => {
    const base = Math.max(DEFAULT_TIMES[TimerMode.WORK], timeLeft);
    return timeLeft > 0 ? ((base - timeLeft) / base) * 100 : 100;
  };

  return (
    <div className="h-screen bg-black text-gh-fg font-sans flex flex-col overflow-hidden">
      <nav className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${isFullscreen ? '-translate-y-full' : 'bg-black/80 backdrop-blur-md border-b border-gh-border'}`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setCurrentView('home')}
          >
            <Logo size={24} />
            <h1 className="font-bold tracking-wider text-sm text-gh-fg">ORBIT FOCUS</h1>
          </div>

          <div className="flex items-center gap-1 md:gap-4">
            {[
              { id: 'home', label: t('navigation.home') },
              { id: 'timer', label: t('navigation.timer') },
              { id: 'stats', label: t('navigation.stats') }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id as 'home' | 'timer' | 'stats')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${currentView === item.id
                  ? 'bg-gh-surface text-white shadow-sm'
                  : 'text-gh-subtle hover:text-gh-fg hover:bg-gh-surface/50'
                  }`}
              >
                {item.label}
              </button>
            ))}
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      <main className={`flex-1 w-full flex flex-col relative overflow-hidden ${isFullscreen ? '' : 'mt-16'}`}>
        {currentView === 'home' && (
          <div>
            <HomeView onStart={() => setCurrentView('timer')} />
          </div>
        )}
        {currentView === 'stats' && (
          <div>
            <StatsView />
          </div>
        )}
        <div
          className={`flex-1 flex flex-col items-center justify-center animate-in fade-in duration-300 relative ${currentView === 'timer' ? 'flex' : 'hidden'}`}
        >
          <div className="absolute top-6 left-6 z-20 hidden md:flex items-center gap-3 group">
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gh-subtle hover:text-gh-fg bg-gh-surface/50 hover:bg-gh-surface rounded-lg transition-all border border-transparent hover:border-gh-border"
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
            <span className="text-xs font-medium text-gh-subtle bg-gh-surface/80 px-3 py-1.5 rounded-full border border-gh-border opacity-0 group-hover:opacity-100 transition-opacity cursor-help select-none whitespace-nowrap">
              {isFullscreen ? 'Press Esc to exit fullscreen' : 'Press F11 for Fullscreen'}
            </span>
          </div>

          {/* 标签栏 - 绝对定位到顶部 */}
          <div className={`absolute top-8 left-1/2 -translate-x-1/2 z-10 ${currentView === 'timer' ? 'block' : 'hidden'}`}>
            <div className="flex items-center gap-4">
              <div className="bg-gh-surface/80 backdrop-blur-md border border-gh-border rounded-full p-1.5 flex items-center gap-1 shadow-2xl">
                {(['pomodoro', 'countdown', 'todo'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTimerTab(tab)}
                    className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${activeTimerTab === tab
                      ? (zenMode ? 'bg-gh-success-emph text-white shadow-lg shadow-gh-success/20' : 'bg-gh-danger-emph text-white shadow-lg shadow-gh-danger-emph/20')
                      : 'text-gh-muted]<]minimax[>[ hover:text-white hover:bg-gh-border-muted'
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
                  ? 'bg-gh-success-emph text-white shadow-gh-success/20'
                  : 'bg-gh-surface/80 backdrop-blur-md border border-gh-border text-gh-muted]<]minimax[>[ hover:text-white hover:border-gh-fg/30 hover:bg-gh-danger-emph/20'
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
                  <div className="text-gh-muted]<]minimax[>[ text-lg md:text-xl mt-4 font-medium tracking-wide uppercase">
                    {formatDate(currentTime)}
                  </div>
                  <div className="text-gh-subtle text-sm md:text-base mt-2 font-mono opacity-80">
                    {formatTimezoneInfo()}
                  </div>
                </div>
              </div>
            )}

            {activeTimerTab === 'countdown' && (
              <div className="flex flex-col items-center w-full animate-in fade-in duration-500 mt-16 text-center">
                <div className="mb-12 relative w-72 h-72 md:w-[24rem] md:h-[24rem] lg:w-[31rem] lg:h-[31rem] flex items-center justify-center">
                  {/* Background Ring */}
                  <div className="absolute inset-0 rounded-full border-4 border-gh-border opacity-30"></div>

                  {/* Progress Ring */}
                  <svg className="w-full h-full rotate-90 transform">
                    <circle
                      cx="50%"
                      cy="50%"
                      r="48%"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className={`${zenMode ? 'text-gh-success' : 'text-gh-danger-emph'} transition-all duration-1000 ease-linear`}
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
                    <div className="text-gh-muted]<]minimax[>[ text-sm md:text-lg mt-3 font-medium tracking-wide">
                      {countdownActive ? 'RUNNING' : 'PAUSED'}
                    </div>
                  </div>

                  {/* Right Side Input */}
                  {!countdownActive && (
                    <div className="absolute -right-28 md:-right-40 lg:-right-56 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 bg-black p-4 rounded-xl border border-gh-border shadow-xl">
                      <span className="text-gh-subtle text-[10px] font-bold uppercase tracking-wider">SET TIME</span>
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
                            className="w-12 bg-transparent text-white text-3xl font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-b border-gh-border focus:border-gh-accent transition-colors pb-1"
                          />
                          <span className="text-gh-subtle text-xs font-medium">h</span>
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
                            className="w-16 bg-transparent text-white text-3xl font-bold text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-b border-gh-border focus:border-gh-accent transition-colors pb-1"
                          />
                          <span className="text-gh-subtle text-xs font-medium">min</span>
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
                        setCountdownStartTime(new Date());
                      } else if (countdownActive && countdownStartTime) {
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
                      ? 'bg-gh-warning/20 text-gh-warning hover:bg-gh-warning/30 ring-1 ring-gh-warning/50'
                      : 'bg-gh-success-emph text-white hover:bg-gh-success-emph shadow-gh-success/20'
                      }`}
                  >
                    {countdownActive ? (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                    ) : (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    )}
                  </button>

                  <button
                    aria-label="Reset Timer"
                    onClick={() => {
                      setCountdownActive(false);
                      if (countdownTimeLeft === countdownTime) {
                        setCountdownTime(1800);
                        setCountdownTimeLeft(1800);
                        setCountdownInput(30);
                        setCountdownInputHours(0);
                      } else {
                        setCountdownTimeLeft(countdownTime);
                      }
                    }}
                    className="w-16 h-16 rounded-full bg-gh-surface text-gh-fg flex items-center justify-center hover:bg-gh-border-muted hover:text-white transition-all hover:rotate-180 active:scale-95 duration-500 shadow-lg"
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
    </div>
  );
};

export default function App() {
  return (
    <AppContent />
  );
}