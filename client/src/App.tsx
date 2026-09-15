import React, { useState, useEffect, useCallback } from 'react';
import { Task, SessionStatsResponse, CalendarMonth, CalendarDay, HeatmapRow } from './types';
import { TaskList } from './components/TaskList';
import { Logo } from './components/Logo';
import { Footer } from './components/Footer';
import FlipClock from './components/FlipClock';
import type { ClockStyle, CountdownState, TimerActions } from './hooks/useTimerState';
import { useI18n, LanguageSwitcher, Language } from './contexts/I18nContext';
import { BackgroundLayer } from './components/BackgroundLayer';
import { useTheme } from './contexts/ThemeContext';
import { getStats, listTasks, syncTasks } from './services/store';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthButton } from './components/AuthButton';
import CountdownPage from './components/CountdownPage';
import { useTimerState } from './hooks/useTimerState';

import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Slider } from './components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { Input } from './components/ui/input';
import { Maximize2, Minimize2, Play, Pause, RotateCcw, Moon, Sun, Flower2, Home, Timer, CalendarClock, BarChart3, Settings } from 'lucide-react';

// --- View Components ---

const HomeView: React.FC<{ onStartFocus: () => void }> = ({ onStartFocus }) => {
  const { t } = useI18n();
  return (
    <div className="flex flex-col min-h-full w-full pb-20">
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-12 lg:gap-14 w-full max-w-7xl mx-auto px-6 py-8 animate-in fade-in duration-700">
      <div className="space-y-8 max-w-xl text-center lg:text-left">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gh-inset text-sm font-medium text-gh-muted">
          {t('home.productBadge')}
        </div>
        <div className="space-y-3">
          <h1 className="text-5xl md:text-7xl xl:text-8xl font-bold text-gh-fg tracking-tight leading-[1.05] text-balance">
            {t('home.heroTitle')}
          </h1>
          <h1 className="text-4xl md:text-6xl xl:text-7xl font-bold text-gh-muted tracking-tight leading-[1.05] pb-2 text-balance">
            {t('home.heroSubtitle')}
          </h1>
        </div>
        <p className="text-xl text-gh-muted leading-relaxed">
          {t('home.description')}
        </p>
        <div className="flex items-center justify-center lg:justify-start gap-3 pt-2">
          <Button size="lg" onClick={onStartFocus}>
            {t('home.startFocus')}
          </Button>
        </div>
      </div>
      <div className="w-full max-w-sm sm:max-w-lg lg:max-w-[600px] lg:h-[min(600px,calc(100dvh-260px))] flex items-center justify-center lg:justify-end lg:-mr-[clamp(0px,calc((100vw-1232px)/2-24px),140px)]">
        <img
          src="/home-dial.webp"
          alt="Tomato time"
          className="w-full lg:w-auto lg:max-h-full rounded-3xl ring-1 ring-gh-border"
          draggable={false}
        />
      </div>
      </div>
    </div>
  );
};

const StatsView: React.FC = () => {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const [stats, setStats] = useState<SessionStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const userStats = await getStats();
      setStats(userStats);
    } catch (err) {
      console.error('Failed to load statistics:', err);
      setError(err instanceof Error ? err.message : t('stats.loadFailed'));
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
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 pb-24 lg:p-8 lg:pb-24">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between pb-2">
              <div className="h-5 w-32 rounded bg-gh-border/60 animate-pulse" />
              <div className="h-4 w-12 rounded bg-gh-border/60 animate-pulse" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="p-5 lg:p-4 rounded-2xl bg-gh-surface">
                  <div className="h-3 w-20 rounded bg-gh-border/60 animate-pulse mb-3" />
                  <div className="h-7 w-16 rounded bg-gh-border/60 animate-pulse" />
                </div>
              ))}
            </div>

            <div className="bg-gh-surface rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 lg:py-3 border-b border-gh-border-muted">
                <div className="h-4 w-28 rounded bg-gh-border/60 animate-pulse" />
                <div className="h-4 w-40 rounded bg-gh-border/60 animate-pulse" />
              </div>
              <div className="relative px-5 py-6">
                <div className="flex items-end h-48 lg:h-[clamp(128px,24vh,192px)] gap-3 relative" style={{ paddingLeft: '50px' }}>
                  {Array.from({ length: 7 }).map((_, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end">
                      <div className="w-full max-w-[32px] rounded-t-sm bg-gh-border/60 animate-pulse" style={{ height: '60%' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gh-surface rounded-2xl overflow-hidden">
              <div className="px-5 py-4 lg:py-3 border-b border-gh-border-muted">
                <div className="flex gap-10">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="min-w-[90px]">
                      <div className="h-3 w-20 rounded bg-gh-border/60 animate-pulse mb-2" />
                      <div className="h-7 w-12 rounded bg-gh-border/60 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full overflow-x-auto px-5 py-5">
                <div className="flex gap-2">
                  {Array.from({ length: 12 }).map((_, idx) => (
                    <div key={idx} className="flex flex-col items-center min-w-[60px]">
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {Array.from({ length: 31 }).map((__, dayIdx) => (
                          <div key={dayIdx} className="w-2 h-2 rounded-sm bg-gh-border/60 animate-pulse" />
                        ))}
                      </div>
                      <div className="h-3 w-8 rounded bg-gh-border/60 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto md:overflow-hidden p-6 pb-24 md:p-6 md:pb-6">
        <div className="max-w-6xl mx-auto space-y-6 md:space-y-4">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-lg font-semibold text-gh-fg tracking-tight">{t('stats.title')}</h2>
            {error && (
              <Button variant="outline" size="sm" onClick={fetchStats}>
                {t('stats.retry')}
              </Button>
            )}
          </div>

          {error && (
            <div className="text-xs text-gh-muted bg-gh-surface rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            <div className="p-5 lg:p-4 rounded-2xl bg-gh-surface">
              <h3 className="text-gh-muted text-[11px] mb-3 uppercase tracking-wider font-semibold">{t('stats.todayFocus')}</h3>
              <div className="text-2xl text-gh-fg font-mono tabular-nums font-medium">{formatMinutes(stats?.todayFocus || 0)}</div>
            </div>
            <div className="p-5 lg:p-4 rounded-2xl bg-gh-surface">
              <h3 className="text-gh-muted text-[11px] mb-3 uppercase tracking-wider font-semibold">{t('stats.weeklyTotal')}</h3>
              <div className="text-2xl text-gh-fg font-mono tabular-nums font-medium">{formatMinutes(stats?.weeklyTotal || 0)}</div>
            </div>
            <div className="p-5 lg:p-4 rounded-2xl bg-gh-surface">
              <h3 className="text-gh-muted text-[11px] mb-3 uppercase tracking-wider font-semibold">{t('stats.streak')}</h3>
              <div className="text-2xl text-gh-danger font-mono tabular-nums font-medium">{studyStats.current || 0} {t('stats.days')}</div>
            </div>
            <div className="p-5 lg:p-4 rounded-2xl bg-gh-surface">
              <h3 className="text-gh-muted text-[11px] mb-3 uppercase tracking-wider font-semibold">{t('stats.totalTime')}</h3>
              <div className="text-2xl text-gh-fg font-mono tabular-nums font-medium">{formatMinutes(stats?.totalDuration || 0)}</div>
            </div>
          </div>

          <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:items-start md:space-y-0 lg:space-y-4 lg:block">
            <div className="bg-gh-surface rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 lg:py-3 border-b border-gh-border-muted">
                <h3 className="text-gh-fg font-medium text-sm">{t('stats.last7Days')}</h3>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gh-success-emph rounded-sm"></div>
                <span className="text-xs text-gh-muted">{t('stats.yourFocusTime')}</span>
              </div>
            </div>

            <div className="relative px-5 py-6">
              <div className="flex items-end h-48 lg:h-[clamp(128px,24vh,192px)] gap-3 relative" style={{ paddingLeft: '50px' }}>
                <div className="absolute left-12 top-0 bottom-0 w-px bg-gh-border-muted"></div>
                <div className="absolute left-12 right-0 h-px bg-gh-border-muted" style={{ bottom: '0%' }}></div>
                <div className="absolute left-12 right-0 h-px bg-gh-border-muted" style={{ bottom: '50%' }}></div>
                <div className="absolute left-12 right-0 h-px bg-gh-border-muted" style={{ bottom: '100%' }}></div>

                {dayLabels.map((day, i) => {
                  const val = weeklyData[i] || 0;
                  const heightPercent = val > 0 ? Math.max((val / maxVal) * 100, 4) : 0;

                  return (
                    <div key={`${day}-${i}`} className="flex flex-col items-center flex-1 h-full">
                      <div className="w-full h-full relative flex items-end justify-center">
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[32px] rounded-t-md ${val > 0 ? 'bg-gh-success-emph' : 'bg-transparent'}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="absolute left-5 top-6 h-48 lg:h-[clamp(128px,24vh,192px)] flex flex-col justify-between text-[11px] text-gh-muted font-mono" style={{ width: '40px' }}>
                <div className="text-right pr-2">{Math.round(maxVal)}m</div>
                <div className="text-right pr-2">{Math.round(maxVal / 2)}m</div>
                <div className="text-right pr-2">0m</div>
              </div>

              <div className="flex mt-3" style={{ marginLeft: '50px' }}>
                <div className="flex flex-1 gap-2">
                  {dayLabels.map((day, index) => (
                    <div key={index} className="text-[11px] text-gh-muted px-1 flex-1 text-center font-mono">
                      {day}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gh-surface rounded-2xl overflow-hidden">
            <div className="px-5 py-4 lg:py-3 border-b border-gh-border-muted">
              <div className="flex justify-between items-start">
                <div className="flex gap-10">
                  <div className="min-w-[90px]">
                    <div className="text-[11px] text-gh-muted mb-1.5 uppercase tracking-wider font-semibold">{t('stats.currentStreak')}</div>
                    <div className="text-2xl font-mono tabular-nums font-medium text-gh-fg">{studyStats.current} {t('stats.days')}</div>
                  </div>
                  <div className="min-w-[90px]">
                    <div className="text-[11px] text-gh-muted mb-1.5 uppercase tracking-wider font-semibold">{t('stats.maxStreak')}</div>
                    <div className="text-2xl font-mono tabular-nums font-medium text-gh-fg">{studyStats.max} {t('stats.days')}</div>
                  </div>
                  <div className="min-w-[90px]">
                    <div className="text-[11px] text-gh-muted mb-1.5 uppercase tracking-wider font-semibold">{t('stats.totalDays')}</div>
                    <div className="text-2xl font-mono tabular-nums font-medium text-gh-success">{studyStats.totalDays} {t('stats.days')}</div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 text-xs text-gh-muted">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span>{t('stats.less')}</span>
                    <div className="w-2.5 h-2.5 bg-gh-border-muted rounded-[3px]"></div>
                    <div className="w-2.5 h-2.5 bg-gh-success-emph/30 rounded-[3px]"></div>
                    <div className="w-2.5 h-2.5 bg-gh-success-emph/50 rounded-[3px]"></div>
                    <div className="w-2.5 h-2.5 bg-gh-success-emph/80 rounded-[3px]"></div>
                    <div className="w-2.5 h-2.5 bg-gh-success-emph rounded-[3px]"></div>
                    <span>{t('stats.more')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full overflow-x-auto px-5 py-5 lg:py-4">
              <div className="inline-flex gap-2 pb-2">
                {studyCalendar.map((monthData, monthIndex) => (
                  <div key={monthIndex} className="flex flex-col items-center min-w-[64px]">
                    <div className="grid grid-cols-7 gap-1.5 lg:gap-1 mb-2">
                      {(monthData.weeks || []).flat().map((day, dayIndex) => (
                        <div
                          key={dayIndex}
                          className={`w-2.5 h-2.5 lg:w-2 lg:h-2 rounded-[3px] ${day.isEmpty ? 'bg-transparent' :
                            day.activityLevel === 0 ? 'bg-gh-border-muted' :
                              day.activityLevel === 1 ? 'bg-gh-success-emph/30' :
                                day.activityLevel === 2 ? 'bg-gh-success-emph/50' :
                                  day.activityLevel === 3 ? 'bg-gh-success-emph/80' :
                                    'bg-gh-success-emph'
                            }`}
                          title={day.date ? `${day.date}: ${Math.round((day.workTime ?? 0) / 60)}${t('heatmap.minutes')}` : t('heatmap.noData')}
                        ></div>
                      ))}
                    </div>
                    <div className="text-[11px] text-gh-muted font-mono font-medium">
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
    </div>
  );
};

const STYLES: ClockStyle[] = ['digital', 'flip'];

const SettingsView: React.FC<{
  timeStyle: ClockStyle;
  countdownStyle: ClockStyle;
  onTimeStyleChange: (style: ClockStyle) => void;
  onCountdownStyleChange: (style: ClockStyle) => void;
}> = ({ timeStyle, countdownStyle, onTimeStyleChange, onCountdownStyleChange }) => {
  const { t } = useI18n();
  const { theme, setThemeMode } = useTheme();

  const handleModeSwitch = (mode: 'dark' | 'light') => {
    setThemeMode(mode);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto md:overflow-hidden p-6 pb-24 md:p-6 md:pb-6">
        <div className="max-w-6xl mx-auto space-y-6 md:space-y-4">
          <div className="pb-2">
            <h2 className="text-lg font-semibold text-gh-fg tracking-tight">{t('settings.title')}</h2>
          </div>

          {/* Time Style */}
          <div className="bg-gh-surface rounded-2xl overflow-hidden">
            <div className="px-5 py-4 lg:py-3 border-b border-gh-border-muted">
              <h3 className="text-gh-fg font-medium text-sm">{t('settings.timeStyle')}</h3>
              <p className="text-gh-muted text-xs mt-1">{t('settings.timeStyleDescription')}</p>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                {STYLES.map(style => (
                  <Button
                    key={style}
                    variant={timeStyle === style ? 'default' : 'outline'}
                    onClick={() => onTimeStyleChange(style)}
                  >
                    {t(`settings.${style}`)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Countdown Style */}
          <div className="bg-gh-surface rounded-2xl overflow-hidden">
            <div className="px-5 py-4 lg:py-3 border-b border-gh-border-muted">
              <h3 className="text-gh-fg font-medium text-sm">{t('settings.countdownStyle')}</h3>
              <p className="text-gh-muted text-xs mt-1">{t('settings.countdownStyleDescription')}</p>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                {STYLES.map(style => (
                  <Button
                    key={style}
                    variant={countdownStyle === style ? 'default' : 'outline'}
                    onClick={() => onCountdownStyleChange(style)}
                  >
                    {t(`settings.${style}`)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Theme: Dark/Light Mode */}
          <div className="bg-gh-surface rounded-2xl overflow-hidden">
            <div className="px-5 py-4 lg:py-3 border-b border-gh-border-muted">
              <h3 className="text-gh-fg font-medium text-sm">{t('settings.themeMode')}</h3>
              <p className="text-gh-muted text-xs mt-1">{t('settings.themeModeDescription')}</p>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-4">
                <Button
                  variant={theme.mode === 'dark' ? 'default' : 'outline'}
                  onClick={() => handleModeSwitch('dark')}
                >
                  <Moon className="w-4 h-4" />
                  {t('settings.dark')}
                </Button>
                <Button
                  variant={theme.mode === 'light' ? 'default' : 'outline'}
                  onClick={() => handleModeSwitch('light')}
                >
                  <Sun className="w-4 h-4" />
                  {t('settings.light')}
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

// --- Countdown View ---

const COUNTDOWN_PRESETS = [15, 25, 45, 60];

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const renderStyle = (style: ClockStyle, value: string) => {
  switch (style) {
    case 'flip':
      return <FlipClock value={value} className="drop-shadow-2xl" />;
    case 'digital':
    default:
      return <div className="text-[min(17.6vw,30.8vh)] leading-none font-bold font-mono tabular-nums tracking-tight text-gh-fg">{value}</div>;
  }
};

const CountdownView: React.FC<{
  countdown: CountdownState;
  countdownStyle: ClockStyle;
  actions: TimerActions;
}> = ({ countdown, countdownStyle, actions }) => {
  const { t } = useI18n();
  const [customOpen, setCustomOpen] = useState(false);
  const { toggleCountdown, resetCountdown, setCountdownTime, setCountdownInput, setCountdownInputHours } = actions;

  const isPreset = (minutes: number) =>
    countdown.countdownTime === minutes * 60 &&
    countdown.countdownInputHours === 0 &&
    countdown.countdownInput === minutes;
  const isCustom = customOpen || !COUNTDOWN_PRESETS.some(isPreset);

  const applyPreset = (minutes: number) => {
    setCountdownTime(minutes * 60);
    setCountdownInput(minutes);
    setCountdownInputHours(0);
    setCustomOpen(false);
  };

  return (
    <div className="w-full flex-1 overflow-y-auto md:overflow-hidden">
      <div className="min-h-full flex flex-col items-center justify-center text-center px-4 pt-32 pb-24 animate-in fade-in duration-500">
        {renderStyle(countdownStyle, formatTime(countdown.countdownTimeLeft))}

        <Badge
          variant={countdown.countdownActive ? 'success' : 'secondary'}
          className="mt-5 text-sm md:text-base font-medium tracking-wide"
        >
          {countdown.countdownActive ? t('timer.running') : t('timer.paused')}
        </Badge>

        <div className="flex items-center gap-4 mt-8">
          <Button
            variant="default"
            size="icon"
            onClick={toggleCountdown}
            className="w-16 h-16 rounded-full"
            aria-label={countdown.countdownActive ? 'Pause' : 'Play'}
          >
            {countdown.countdownActive ? (
              <Pause className="w-8 h-8" />
            ) : (
              <Play className="w-8 h-8" />
            )}
          </Button>

          <Button
            variant="secondary"
            size="icon"
            aria-label="Reset Timer"
            onClick={() => {
              if (countdown.countdownTimeLeft === countdown.countdownTime) {
                setCountdownTime(1800);
                setCountdownInput(30);
                setCountdownInputHours(0);
              }
              resetCountdown();
            }}
            className="w-16 h-16 rounded-full"
          >
            <RotateCcw className="w-6 h-6" />
          </Button>
        </div>

        {!countdown.countdownActive && (
          <div className="mt-10 flex flex-col items-center gap-4 w-full">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {COUNTDOWN_PRESETS.map((m) => (
                <Button
                  key={m}
                  size="sm"
                  variant={isPreset(m) ? 'default' : 'outline'}
                  onClick={() => applyPreset(m)}
                >
                  {m} {t('stats.minutes')}
                </Button>
              ))}
              <Button
                size="sm"
                variant={isCustom ? 'default' : 'outline'}
                onClick={() => setCustomOpen((v) => !v)}
              >
                {t('timer.custom')}
              </Button>
            </div>

            {customOpen && (
              <div className="flex flex-col items-center gap-4 bg-gh-surface p-5 rounded-2xl w-full max-w-sm">
                <span className="text-gh-subtle text-[10px] font-bold uppercase tracking-wider">{t('timer.setTime')}</span>
                <div className="grid grid-cols-2 gap-5 w-full">
                  <div className="space-y-2.5">
                    <div className="flex items-baseline justify-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={countdown.countdownInputHours}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            setCountdownInputHours(val);
                            const totalSeconds = (val * 3600) + (countdown.countdownInput * 60);
                            setCountdownTime(totalSeconds);
                          }
                        }}
                        className="w-20 text-2xl font-bold text-center px-2"
                      />
                      <span className="text-gh-subtle text-xs font-medium whitespace-nowrap">{t('stats.hours')}</span>
                    </div>
                    <Slider
                      value={[countdown.countdownInputHours]}
                      onValueChange={([v]) => {
                        setCountdownInputHours(v);
                        const totalSeconds = (v * 3600) + (countdown.countdownInput * 60);
                        setCountdownTime(totalSeconds);
                      }}
                      min={0}
                      max={23}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-baseline justify-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={59}
                        value={countdown.countdownInput}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            setCountdownInput(val);
                            const totalSeconds = (countdown.countdownInputHours * 3600) + (val * 60);
                            setCountdownTime(totalSeconds);
                          }
                        }}
                        className="w-20 text-2xl font-bold text-center px-2"
                      />
                      <span className="text-gh-subtle text-xs font-medium whitespace-nowrap">{t('stats.minutes')}</span>
                    </div>
                    <Slider
                      value={[countdown.countdownInput]}
                      onValueChange={([v]) => {
                        setCountdownInput(v);
                        const totalSeconds = (countdown.countdownInputHours * 3600) + (v * 60);
                        setCountdownTime(totalSeconds);
                      }}
                      min={0}
                      max={59}
                      step={1}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App Component ---

const AppContent: React.FC = () => {
  const { t, language } = useI18n();
  const { user, isReady } = useAuth();
  const [appState, appActions] = useTimerState();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    countdown,
    zenMode,
    currentView,
    activeTimerTab,
    tasks,
    timeStyle,
    countdownStyle,
  } = appState;

  const {
    toggleZenMode,
    setCurrentView,
    setActiveTimerTab,
    setTasks,
    setTimeStyle,
    setCountdownStyle,
    setIsFullscreen: setAppIsFullscreen,
  } = appActions;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setAppIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
      setGlobalError(`${t('errors.unknownError')}: ${message}`);
    };

    const handleError = (event: ErrorEvent) => {
      setGlobalError(`${t('errors.unknownError')}: ${event.message}`);
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearInterval(clockInterval);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, [setAppIsFullscreen]);

  // Load tasks from the store (cloud or local) on mount and whenever the
  // auth state settles, so the todo tab is no longer write-only.
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    void (async () => {
      try {
        const stored = await listTasks();
        if (!cancelled) setTasks(stored);
      } catch (error) {
        console.error('Failed to load tasks:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, isReady, setTasks]);

  const handleTaskChange = useCallback(async (taskUpdater: React.SetStateAction<Task[]>) => {
    // Resolve the actual Task[] from the updater
    const resolvedTasks: Task[] = typeof taskUpdater === 'function'
      ? taskUpdater(tasks)
      : taskUpdater;
    setTasks(resolvedTasks);

    // Persist the diff (optimistic UI: state already updated above)
    void syncTasks(tasks, resolvedTasks);
  }, [setTasks, tasks]);

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

  return (
	    <div className="h-full bg-transparent text-gh-fg font-sans flex flex-col overflow-hidden">
	      <BackgroundLayer />
	      {globalError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-xl w-[calc(100%-2rem)]">
          <div className="flex items-start gap-3 rounded-xl bg-gh-error-bg px-4 py-3 text-sm text-gh-danger">
            <span className="flex-1 break-words">{globalError}</span>
            <button
              onClick={() => setGlobalError(null)}
              className="mt-0.5 text-gh-muted"
              aria-label="Dismiss error"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <nav className={`fixed inset-x-0 top-0 z-50 h-14 px-4 sm:px-6 bg-gh-canvas ${isFullscreen ? 'hidden' : 'flex items-center justify-between'}`}>
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => setCurrentView('home')}
        >
          <Logo size={22} />
          <h1 className="font-semibold tracking-[0.08em] text-sm text-gh-fg hidden sm:block">ORBIT FOCUS</h1>
        </div>

        <Tabs
          value={currentView}
          onValueChange={(v) => setCurrentView(v as 'home' | 'timer' | 'countdown' | 'stats' | 'settings')}
        >
          <TabsList className="bg-transparent">
            {[
              { id: 'home', label: t('navigation.home'), icon: Home },
              { id: 'timer', label: t('navigation.timer'), icon: Timer },
              { id: 'countdown', label: t('navigation.countdown'), icon: CalendarClock },
              { id: 'stats', label: t('navigation.stats'), icon: BarChart3 },
              { id: 'settings', label: t('navigation.settings'), icon: Settings }
            ].map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="px-3 sm:px-4"
                aria-label={item.label}
                title={item.label}
              >
                <item.icon className="h-4 w-4 sm:hidden" aria-hidden="true" />
                <span className="hidden sm:inline">{item.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1">
          <AuthButton />
          <LanguageSwitcher />
        </div>
      </nav>

      {/* fixed 导航栏的占位，同时为全屏态隐藏 */}
      {!isFullscreen && <div className="h-14 shrink-0" aria-hidden="true" />}

      <main className="flex-1 w-full flex flex-col relative overflow-hidden">
        {currentView === 'home' && (
          <div className="flex-1 overflow-y-auto">
            <HomeView onStartFocus={() => setCurrentView('timer')} />
          </div>
        )}
        {currentView === 'countdown' && <CountdownPage />}
        {currentView === 'stats' && <StatsView />}
        {currentView === 'settings' && (
          <SettingsView
            timeStyle={timeStyle}
            countdownStyle={countdownStyle}
            onTimeStyleChange={setTimeStyle}
            onCountdownStyleChange={setCountdownStyle}
          />
        )}
        <div
          className={`flex-1 flex flex-col items-center justify-center animate-in fade-in duration-300 relative ${currentView === 'timer' ? 'flex' : 'hidden'}`}
        >
          <div className="absolute top-4 left-6 z-20 hidden md:flex items-center gap-3 group">
            <Button
              variant="secondary"
              size="icon"
              onClick={toggleFullscreen}
              title={isFullscreen ? t('timer.fullscreenExit') : t('timer.fullscreenEnter')}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
            <Badge variant="secondary" className="text-xs font-medium">
              {isFullscreen ? t('timer.fullscreenHintExit') : t('timer.fullscreenHintEnter')}
            </Badge>
          </div>

          {/* 标签栏 - 绝对定位到顶部 */}
          <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-10 ${currentView === 'timer' ? 'block' : 'hidden'}`}>
            <div className="flex items-center gap-4">
              <Tabs value={activeTimerTab} onValueChange={(v) => setActiveTimerTab(v as 'pomodoro' | 'countdown' | 'todo')}>
                <TabsList>
                  {(['pomodoro', 'countdown', 'todo'] as const).map(tab => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="px-6"
                    >
                      {t(`timer.tabs.${tab}`)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* 禅静模式切换按钮 */}
              <Button
                variant={zenMode ? 'default' : 'outline'}
                size="icon"
                onClick={toggleZenMode}
                title={zenMode ? t('timer.exitZenMode') : t('timer.enterZenMode')}
              >
                <Flower2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 主内容 - 完全居中 */}
          <div className={`w-full h-full flex items-center justify-center ${currentView === 'timer' ? 'flex' : 'hidden'}`}>
            {activeTimerTab === 'pomodoro' && (
              <div className="flex flex-col items-center justify-center animate-in fade-in duration-500 mb-16">
                <div className="flex flex-col items-center">
                  <div className="text-gh-muted text-base md:text-2xl font-medium tracking-wide mb-6">
                    {formatDate(currentTime)}
                  </div>
                  {renderStyle(timeStyle, formatRealTime(currentTime))}
                </div>
              </div>
            )}

            {activeTimerTab === 'countdown' && (
              <CountdownView
                countdown={countdown}
                countdownStyle={countdownStyle}
                actions={appActions}
              />
            )}

            {activeTimerTab === 'todo' && (
              <div className="w-full max-w-4xl mx-auto">
                <div className="w-full bg-transparent overflow-hidden flex flex-col" style={{ height: isFullscreen ? 'calc(100vh - 250px)' : 'calc(100vh - 330px)' }}>
                  <TaskList tasks={tasks} setTasks={handleTaskChange} isSaving={false} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 全站固定底栏：版权 + 社交链接，不随内容滚动 */}
      {!isFullscreen && <Footer />}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}