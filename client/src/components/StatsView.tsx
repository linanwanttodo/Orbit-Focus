import React, { useState, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { getUserStats } from '../services/apiService';

export const StatsView: React.FC = () => {
    const { t, language } = useI18n();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const userStats = await getUserStats();
                setStats(userStats);
            } catch (error) {
                console.error('获取统计数据失败:', error);
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
                setLoading(false);
            }
        };

        fetchStats();
    }, []); // 保持为空依赖，但在组件挂载时（即进入统计页面时）触发加载

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

        heatmapData.forEach((day: any) => {
            heatmapMap.set(day.date, {
                work_time: day.work_time || 0
            });
        });

        const monthNames: any = {
            en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            zh: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
            ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
        };

        const validLanguage = (language && monthNames[language]) ? language : 'en';

        for (let month = 0; month < 12; month++) {
            const monthData: any = {
                monthIndex: month,
                monthName: monthNames[validLanguage][month],
                weeks: []
            };

            const firstDay = new Date(currentYear, month, 1);
            const lastDay = new Date(currentYear, month + 1, 0);
            const weeks: any[] = [];
            let currentWeek: any[] = [];

            const firstDayOfWeek = firstDay.getDay();
            for (let i = 0; i < firstDayOfWeek; i++) {
                currentWeek.push({ date: null, activityLevel: 0, isEmpty: true });
            }

            let currentDate = new Date(firstDay);

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

    let studyCalendar: any[] = [];
    let dayLabels: string[] = [];

    try {
        studyCalendar = generateStudyCalendar();
        dayLabels = getLast7DaysLabels();
    } catch (error) {
        console.error('生成统计数据失败:', error);
        studyCalendar = [];
        dayLabels = [];
    }

    if (loading) {
        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
                    <div className="flex justify-center items-center h-64">
                        <div className="text-slate-400">{t('stats.loadingStats')}</div>
                    </div>
                </div>
            </div>
        );
    }

    const weeklyData = stats?.weeklyData || Array(7).fill(0);
    const maxVal = Math.max(...weeklyData, 30); // 调低最小值，让波动更明显

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
                <div className="max-w-5xl mx-auto space-y-3">
                    <h2 className="text-lg font-semibold text-white">{t('stats.title')}</h2>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                        <div className="p-4 rounded-xl border border-slate-700/50 bg-dark-800/20">
                            <h3 className="text-slate-500 text-xs mb-2 uppercase tracking-wider">{t('stats.todayFocus')}</h3>
                            <div className="text-2xl text-white font-mono">{formatMinutes(stats?.todayFocus || 0)}</div>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-700/50 bg-dark-800/20">
                            <h3 className="text-slate-500 text-xs mb-2 uppercase tracking-wider">{t('stats.weeklyTotal')}</h3>
                            <div className="text-2xl text-white font-mono">{formatMinutes(stats?.weeklyTotal || 0)}</div>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-700/50 bg-dark-800/20">
                            <h3 className="text-slate-500 text-xs mb-2 uppercase tracking-wider">{t('stats.streak')}</h3>
                            <div className="text-2xl text-rose-500 font-mono">{studyStats.current || 0} {t('stats.days')}</div>
                        </div>
                        <div className="p-4 rounded-xl border border-slate-700/50 bg-dark-800/20">
                            <h3 className="text-slate-500 text-xs mb-2 uppercase tracking-wider">{t('stats.totalTime')}</h3>
                            <div className="text-2xl text-white font-mono">{formatMinutes(stats?.totalDuration || 0)}</div>
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl border border-slate-700/50 bg-dark-800/20">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-slate-200 font-medium">{t('stats.last7Days')}</h3>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                                    <span className="text-xs text-slate-400">{t('stats.yourFocusTime')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            <div className="flex items-end h-48 gap-3 relative" style={{ paddingLeft: '50px' }}>
                                <div className="absolute left-12 top-0 bottom-0 w-px bg-slate-700/50"></div>
                                <div className="absolute left-12 right-0 h-px bg-slate-700/30" style={{ bottom: '0%' }}></div>
                                <div className="absolute left-12 right-0 h-px bg-slate-700/30" style={{ bottom: '50%' }}></div>
                                <div className="absolute left-12 right-0 h-px bg-slate-700/30" style={{ bottom: '100%' }}></div>

                                {dayLabels.map((day: any, i: number) => {
                                    const val = weeklyData[i] || 0;
                                    // 增加最小高度保护，只要 val > 0，至少显示 4% 的高度
                                    const heightPercent = val > 0 ? Math.max((val / maxVal) * 100, 4) : 0;

                                    return (
                                        <div key={`${day}-${i}`} className="flex flex-col items-center flex-1 group relative h-full">
                                            <div className="w-full h-full relative flex items-end justify-center">
                                                <div
                                                    style={{ height: `${heightPercent}%` }}
                                                    className={`w-full max-w-[32px] rounded-t-sm transition-all duration-500 ${val > 0 ? 'bg-emerald-500 hover:bg-emerald-600 shadow-lg' : 'bg-transparent'
                                                        }`}
                                                >
                                                    {val > 0 && (
                                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-xl">
                                                            {val} 分钟
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-slate-500" style={{ width: '45px' }}>
                                <div className="text-right pr-2">{Math.round(maxVal)}m</div>
                                <div className="text-right pr-2">{Math.round(maxVal / 2)}m</div>
                                <div className="text-right pr-2">0m</div>
                            </div>

                            <div className="flex mt-2" style={{ marginLeft: '50px' }}>
                                <div className="flex flex-1 gap-2">
                                    {dayLabels.map((day: any, index: number) => (
                                        <div key={index} className="text-[10px] text-slate-500 px-1 flex-1 text-center">
                                            {day}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl border border-slate-700/50 bg-dark-800/20 w-full">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex gap-8">
                                <div className="min-w-[90px]">
                                    <div className="text-xs text-slate-500 mb-1">{t('stats.currentStreak')}</div>
                                    <div className="text-2xl font-bold text-white">{studyStats.current} {t('stats.days')}</div>
                                </div>
                                <div className="min-w-[90px]">
                                    <div className="text-xs text-slate-500 mb-1">{t('stats.maxStreak')}</div>
                                    <div className="text-2xl font-bold text-white">{studyStats.max} {t('stats.days')}</div>
                                </div>
                                <div className="min-w-[90px]">
                                    <div className="text-xs text-slate-500 mb-1">{t('stats.totalDays')}</div>
                                    <div className="text-2xl font-bold text-emerald-500">{studyStats.totalDays} {t('stats.days')}</div>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 text-xs text-slate-500">
                                <div className="flex items-center gap-1.5">
                                    <span>{t('stats.less')}</span>
                                    <div className="w-2.5 h-2.5 bg-slate-700 rounded-sm"></div>
                                    <div className="w-2.5 h-2.5 bg-emerald-500/30 rounded-sm"></div>
                                    <div className="w-2.5 h-2.5 bg-emerald-500/50 rounded-sm"></div>
                                    <div className="w-2.5 h-2.5 bg-emerald-500/80 rounded-sm"></div>
                                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div>
                                    <span>{t('stats.more')}</span>
                                </div>
                                <div>{new Date().getFullYear()}</div>
                            </div>
                        </div>

                        <div className="w-full overflow-x-auto no-scrollbar">
                            <div className="inline-flex gap-2 pb-2">
                                {studyCalendar.map((monthData: any, monthIndex: number) => (
                                    <div key={monthIndex} className="flex flex-col items-center min-w-[60px]">
                                        <div className="grid grid-cols-7 gap-1 mb-2">
                                            {(monthData.weeks || []).flat().map((day: any, dayIndex: number) => (
                                                <div
                                                    key={dayIndex}
                                                    className={`w-2 h-2 rounded-sm ${day.isEmpty ? 'bg-transparent' :
                                                        day.activityLevel === 0 ? 'bg-slate-700' :
                                                            day.activityLevel === 1 ? 'bg-emerald-500/30' :
                                                                day.activityLevel === 2 ? 'bg-emerald-500/50' :
                                                                    day.activityLevel === 3 ? 'bg-emerald-500/80' :
                                                                        'bg-emerald-500'
                                                        }`}
                                                    title={day.date ? `${day.date}: ${Math.round(day.workTime / 60)}${t('heatmap.minutes')}` : t('heatmap.noData')}
                                                ></div>
                                            ))}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium">
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
