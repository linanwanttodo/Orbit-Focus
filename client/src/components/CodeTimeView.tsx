import React, { useEffect, useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { WakaTimeStats, WakaTimeSummaries } from '../types';

export const CodeTimeView: React.FC = () => {
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<WakaTimeStats['data'] | null>(null);
    const [todayStats, setTodayStats] = useState<any>(null);
    const [summaries, setSummaries] = useState<WakaTimeSummaries['data'] | null>(null);
    const [apiKey, setApiKey] = useState<string>('');

    useEffect(() => {
        const key = localStorage.getItem('wakatime_api_key');
        setApiKey(key || '');
        if (key) {
            fetchStats(key, false);
        } else {
            setLoading(false);
        }
    }, []);

    const fetchStats = async (key: string, forceRefresh: boolean = false) => {
        const baseUrl = localStorage.getItem('wakatime_api_url') || 'https://wakatime.com';

        if (forceRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);
        try {
            if (window.electron) {
                // 如果是强制刷新，先清除缓存
                if (forceRefresh) {
                    if (window.electron.clearWakaTimeCache) {
                        await window.electron.clearWakaTimeCache();
                    }
                }

                const promises = [];

                // 1. Fetch 7-day stats for general info
                if (window.electron.getWakaTimeStats) {
                    promises.push(window.electron.getWakaTimeStats(key, forceRefresh, baseUrl).then(res => setStats(res.data)).catch(e => console.error("Stats error", e)));
                }

                // 2. Fetch today's status bar
                if (window.electron.getWakaTimeStatusBar) {
                    promises.push(window.electron.getWakaTimeStatusBar(key, forceRefresh, baseUrl).then(res => setTodayStats(res.data)).catch(e => console.error("StatusBar error", e)));
                }

                // 3. Fetch summaries for charts
                if (window.electron.getWakaTimeSummaries) {
                    promises.push(window.electron.getWakaTimeSummaries(key, forceRefresh, baseUrl).then(res => setSummaries(res.data)).catch(e => console.error("Summaries error", e)));
                }

                await Promise.all(promises);
            } else {
                // Fallback for browser dev mode (mock data or error)
                console.warn('WakaTime API not available in browser mode');
                setError('Electron environment required');
            }
        } catch (err: any) {
            console.error('Failed to fetch WakaTime stats:', err);
            setError(err.message || 'Failed to fetch data');
            setStats(null);
            setTodayStats(null);
            setSummaries(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Prepare chart data with categories, languages, and editors for each day
    const chartData = useMemo(() => {
        const sourceData = Array.isArray(summaries) ? summaries : [];
        const data = sourceData
            .filter(day => day && day.range && day.range.date)
            .map(day => ({
                date: day.range.date,
                hours: (day.grand_total?.total_seconds || 0) / 3600,
                total_seconds: day.grand_total?.total_seconds || 0,
                categories: (day.categories || []).map((cat: any) => ({
                    name: cat.name,
                    hours: (cat.total_seconds || 0) / 3600,
                    percent: cat.percent || 0,
                    text: cat.text || ''
                })),
                languages: day.languages || [],
                editors: day.editors || []
            }));

        // 确保即使 summaries 为空，后续逻辑也有数组可处理
        if (data.length === 0 && todayStats) {
            const todayDate = new Date().toISOString().split('T')[0];
            const totalSeconds = todayStats.grand_total?.total_seconds || 0;
            if (totalSeconds > 0) {
                data.push({
                    date: todayDate,
                    hours: totalSeconds / 3600,
                    total_seconds: totalSeconds,
                    categories: todayStats.categories || [],
                    languages: todayStats.languages || [],
                    editors: todayStats.editors || []
                });
            }
        }
        return data;
    }, [summaries, todayStats]);

    // Aggregation Logic from Summaries
    // 基于 chartData 聚合计算语言和编辑器的近7天数据
    const { aggregatedLanguages, aggregatedEditors, aggregatedTotalSeconds, bestDay } = useMemo(() => {
        const langMap = new Map<string, number>();
        const editorMap = new Map<string, number>();
        let totalSeconds = 0;
        let maxSeconds = 0;
        let bestDay = { date: '', text: '-' };

        chartData.forEach(day => {
            const daySeconds = day.total_seconds || 0;
            totalSeconds += daySeconds;

            if (daySeconds > maxSeconds) {
                maxSeconds = daySeconds;
                bestDay = {
                    date: day.date,
                    text: `${(daySeconds / 3600).toFixed(1)} hrs`
                };
            }

            if (day.languages && Array.isArray(day.languages)) {
                day.languages.forEach((l: any) => {
                    if (l && l.name) {
                        langMap.set(l.name, (langMap.get(l.name) || 0) + l.total_seconds);
                    }
                });
            }

            if (day.editors && Array.isArray(day.editors)) {
                day.editors.forEach((e: any) => {
                    if (e && e.name) {
                        editorMap.set(e.name, (editorMap.get(e.name) || 0) + e.total_seconds);
                    }
                });
            }
        });

        const sortAndMap = (map: Map<string, number>, total: number) => {
            return Array.from(map.entries())
                .map(([name, sec]) => ({
                    name,
                    percent: total > 0 ? (sec / total) * 100 : 0,
                    text: `${(sec / 3600).toFixed(1)} hrs`,
                    total_seconds: sec
                }))
                .sort((a, b) => b.total_seconds - a.total_seconds);
        };

        return {
            aggregatedLanguages: sortAndMap(langMap, totalSeconds),
            aggregatedEditors: sortAndMap(editorMap, totalSeconds),
            aggregatedTotalSeconds: totalSeconds,
            bestDay: bestDay
        };
    }, [chartData]);

    const displayStats = useMemo(() => {
        // 使用聚合的语言和编辑器数据
        return {
            ...stats, // 保留原始 stats 的结构，防止其他地方报错
            languages: aggregatedLanguages,
            editors: aggregatedEditors,
            best_day: bestDay,
            human_readable_total: `${(aggregatedTotalSeconds / 3600).toFixed(1)} hrs`,
            total_seconds: aggregatedTotalSeconds,
            // 确保日均也被正确计算
            daily_average: aggregatedTotalSeconds / 7,
            human_readable_daily_average: `${(aggregatedTotalSeconds / 7 / 3600).toFixed(1)} hrs`
        };
    }, [stats, aggregatedLanguages, aggregatedEditors, bestDay, aggregatedTotalSeconds]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400 animate-pulse">
                {t('common.loading') || 'Loading...'}
            </div>
        );
    }

    if (!apiKey) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-slate-800 flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11.536 9.636 10.122 10.9a2.5 2.5 0 01-3.536 3.536L5.05 13.05a2.5 2.5 0 01-.707-1.77 2.5 2.5 0 01.707-1.77L6.464 8.08a2.5 2.5 0 013.535 0l1.264 1.264L16.257 6.3a6 6 0 012.743.7z" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-200 mb-2">{t('codeTime.wakatimeIntegrated')}</h3>
                <p className="text-slate-400 max-w-md mb-6">
                    {t('codeTime.setApiKeyPrompt')}
                </p>
            </div>
        );
    }

    if (error && !stats && !todayStats) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="text-red-400 mb-2">{t('codeTime.errorLoading')}</div>
                <p className="text-slate-500 text-sm mb-4">{error}</p>
                <button
                    onClick={() => fetchStats(apiKey)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 transition-colors"
                >
                    {t('codeTime.retry')}
                </button>
            </div>
        );
    }

    if (!stats && !todayStats && !summaries) return null;

    // 获取星期几的名称
    const getWeekdayName = (dateStr: string) => {
        const date = new Date(dateStr);
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return weekdays[date.getDay()];
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* 可滚动的主内容区 */}
            <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
                <div className="max-w-5xl mx-auto space-y-3">
                    {/* 标题栏和刷新按钮 */}
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-white">Code Time</h2>
                        <button
                            onClick={() => fetchStats(apiKey, true)}
                            disabled={refreshing}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                                ${refreshing
                                    ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                                    : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'}`}
                        >
                            <svg
                                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                            {refreshing ? t('common.refreshing') || '刷新中...' : t('common.refresh') || '刷新数据'}
                        </button>
                    </div>
                    {/* Header Stats - 线框样式 3列 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg border border-slate-700/50">
                            <h3 className="text-slate-500 text-xs font-medium mb-1">{t('codeTime.last7Days') || '近7天'}</h3>
                            <div className="text-2xl font-bold text-white tracking-tight">
                                {(() => {
                                    // 使用 chartData (summaries) 累加计算，确保数据一致且包含今天
                                    const totalSec = chartData.reduce((acc, day) => acc + (day.hours * 3600), 0);
                                    const hours = Math.floor(totalSec / 3600);
                                    const mins = Math.floor((totalSec % 3600) / 60);
                                    return hours > 0 ? `${hours} hrs ${mins} mins` : `${mins} mins`;
                                })()}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                {(() => {
                                    const totalSec = chartData.reduce((acc, day) => acc + (day.hours * 3600), 0);
                                    // 过滤掉未来日期，只计算有数据的天数或默认为7
                                    const daysCount = chartData.length || 7;
                                    const dailyAvgSec = daysCount > 0 ? totalSec / daysCount : 0;

                                    const hours = Math.floor(dailyAvgSec / 3600);
                                    const mins = Math.floor((dailyAvgSec % 3600) / 60);

                                    return `${t('codeTime.dailyAvg')}: ${hours} hrs ${mins} mins`;
                                })()}
                            </div>
                        </div>
                        <div className="p-3 rounded-lg border border-slate-700/50">
                            <h3 className="text-slate-500 text-xs font-medium mb-1">{t('codeTime.todayCodeTime')}</h3>
                            <div className="text-2xl font-bold text-white tracking-tight">
                                {(() => {
                                    // 优先从统一的 chartData 中获取今日数据，确保一致性
                                    const todayDate = new Date().toISOString().split('T')[0];
                                    const todayData = chartData.find(d => d.date === todayDate);

                                    if (todayData && todayData.hours > 0) {
                                        const totalSeconds = todayData.hours * 3600;
                                        const hours = Math.floor(totalSeconds / 3600);
                                        const mins = Math.floor((totalSeconds % 3600) / 60);
                                        return hours > 0 ? `${hours} hrs ${mins} mins` : `${mins} mins`;
                                    }

                                    return todayStats?.grand_total?.text || '0m';
                                })()}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                                {(() => {
                                    const totalSec = chartData.reduce((acc, day) => acc + (day.hours * 3600), 0);
                                    // 过滤掉未来日期，只计算有数据的天数或默认为7
                                    const daysCount = chartData.length || 7;
                                    const dailyAvgSec = daysCount > 0 ? totalSec / daysCount : 0;

                                    const hours = Math.floor(dailyAvgSec / 3600);
                                    const mins = Math.floor((dailyAvgSec % 3600) / 60);

                                    return `${t('codeTime.dailyAvg')}: ${hours} hrs ${mins} mins`;
                                })()}
                            </div>
                        </div>
                        <div className="p-3 rounded-lg border border-slate-700/50">
                            <h3 className="text-slate-500 text-xs font-medium mb-1">{t('codeTime.bestDay')}</h3>
                            <div className="text-xl font-bold text-white tracking-tight">
                                {(() => {
                                    if (!chartData || chartData.length === 0) return '-';

                                    // 从 chartData 中找出时间最长的一天作为最佳编程日
                                    const bestDay = chartData.reduce((max, day) => (day.hours > max.hours ? day : max), chartData[0]);

                                    // 格式化时间
                                    const totalSeconds = bestDay.hours * 3600;
                                    const hours = Math.floor(totalSeconds / 3600);
                                    const mins = Math.floor((totalSeconds % 3600) / 60);

                                    return hours > 0 ? `${hours} hrs ${mins} mins` : `${mins} mins`;
                                })()}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                                {(() => {
                                    if (!chartData || chartData.length === 0) return '';
                                    const bestDay = chartData.reduce((max, day) => (day.hours > max.hours ? day : max), chartData[0]);
                                    return bestDay.date;
                                })()}
                            </div>
                        </div>
                    </div>

                    {/* Visualization Area */}
                    <div className="py-0">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-medium text-white flex items-center gap-2">
                                <span className="w-1 h-4 bg-sky-500 rounded-full"></span>
                                {t('codeTime.activity')}
                            </h3>
                        </div>

                        {/* Top Horizontal Stacked Bar (Total Distribution) */}
                        <div className="mb-4">
                            <div className="w-full h-2 rounded-full flex overflow-hidden">
                                {(() => {
                                    // Aggregate all categories for total distribution
                                    const categoryTotals = new Map<string, number>();
                                    let totalSeconds = 0;
                                    chartData.forEach(day => {
                                        day.categories.forEach(cat => {
                                            categoryTotals.set(cat.name, (categoryTotals.get(cat.name) || 0) + (cat.hours * 3600));
                                            totalSeconds += (cat.hours * 3600);
                                        });
                                    });

                                    const sortedCats = Array.from(categoryTotals.entries())
                                        .sort((a, b) => b[1] - a[1]) // Sort by value desc
                                        .map(([name, sec]) => ({
                                            name,
                                            percent: totalSeconds > 0 ? (sec / totalSeconds) * 100 : 0,
                                            hours: sec / 3600
                                        }));

                                    const getCategoryColor = (name: string, index: number) => {
                                        // WakaTime Official-like Colors
                                        // Coding: Blue/Sky
                                        // Writing Docs: Cyan/Teal
                                        if (name === 'Coding') return '#3b82f6'; // Blue
                                        if (name === 'Writing Docs') return '#06b6d4'; // Cyan
                                        if (name === 'Building') return '#f59e0b'; // Amber
                                        if (name === 'Communicating') return '#10b981'; // Emerald

                                        const otherColors = ['#8b5cf6', '#ec4899', '#6366f1', '#f97316', '#a855f7', '#d946ef'];
                                        return otherColors[index % otherColors.length];
                                    };

                                    return sortedCats.map((cat, index) => (
                                        <div
                                            key={cat.name}
                                            style={{ width: `${cat.percent}%`, backgroundColor: getCategoryColor(cat.name, index) }}
                                            className="h-full first:rounded-l-md last:rounded-r-md group relative hover:opacity-90 transition-opacity"
                                        >
                                            {/* Tooltip for Top Bar */}
                                            <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 hidden group-hover:block z-20 whitespace-nowrap px-2 py-1 bg-slate-800 text-xs text-white rounded border border-slate-700 shadow-lg">
                                                {cat.name}: {cat.hours.toFixed(1)} hrs ({cat.percent.toFixed(1)}%)
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>

                            {/* Legend below top bar */}
                            <div className="flex flex-wrap gap-4 mt-3 justify-center">
                                {(() => {
                                    // Re-calculate simply for legend keys
                                    const allCategories = new Set<string>();
                                    chartData.forEach(day => day.categories.forEach(cat => allCategories.add(cat.name)));
                                    const orderedCategories = Array.from(allCategories).sort();

                                    const getCategoryColor = (name: string, index: number) => {
                                        if (name === 'Coding') return '#3b82f6';
                                        if (name === 'Writing Docs') return '#06b6d4';
                                        if (name === 'Building') return '#f59e0b';
                                        if (name === 'Communicating') return '#10b981';
                                        const otherColors = ['#8b5cf6', '#ec4899', '#6366f1', '#f97316', '#a855f7', '#d946ef'];
                                        return otherColors[index % otherColors.length];
                                    };

                                    return orderedCategories.map((cat, index) => (
                                        <div key={cat} className="flex items-center text-xs text-slate-400">
                                            <div className="w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: getCategoryColor(cat, index) }}></div>
                                            {cat}
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>

                        {/* Main Grouped Bar Chart */}
                        <div className="h-[150px] w-full mt-1 relative">
                            {/* Background Lines */}
                            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 pl-1 pr-1">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className="w-full h-px bg-slate-700/20 last:bg-slate-700/50"></div>
                                ))}
                            </div>

                            <div className="flex h-full w-full items-end justify-between px-2 pt-4 pb-6 gap-2">
                                {chartData.map((day, dayIndex) => {
                                    // Prepare data for this day
                                    const sortedCategories = [...day.categories]
                                        // Filter out tiny values to keep chart clean
                                        .filter(c => c.hours > 0.01)
                                        .sort((a, b) => {
                                            // Sort categories to keep color order consistent side-by-side
                                            const order = ['Coding', 'Writing Docs', 'Building', 'Communicating'];
                                            const idxA = order.indexOf(a.name);
                                            const idxB = order.indexOf(b.name);
                                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                            if (idxA !== -1) return -1;
                                            if (idxB !== -1) return 1;
                                            return b.hours - a.hours;
                                        });

                                    // Calc Max Group Height for scaling
                                    // Scale against max single category bar to make small bars visible
                                    const maxGroupValue = Math.max(
                                        0.1,
                                        ...chartData.flatMap(d => d.categories.map(c => c.hours))
                                    );

                                    const getCategoryColor = (name: string) => {
                                        if (name === 'Coding') return '#3b82f6';
                                        if (name === 'Writing Docs') return '#06b6d4';
                                        if (name === 'Building') return '#f59e0b';
                                        if (name === 'Communicating') return '#10b981';
                                        const otherColors = ['#8b5cf6', '#ec4899', '#6366f1', '#f97316', '#a855f7', '#d946ef'];
                                        let hash = 0;
                                        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                                        return otherColors[Math.abs(hash) % otherColors.length];
                                    };

                                    return (
                                        <div key={dayIndex} className="flex flex-col items-center justify-end h-full flex-1 group/day relative min-w-0">
                                            {/* Container for grouped bars */}
                                            <div className="flex items-end justify-center w-full h-full gap-[1px]">
                                                {sortedCategories.map((cat, i) => {
                                                    const height = (cat.hours / maxGroupValue) * 100;
                                                    const displayHeight = Math.min(Math.max(height, 2), 100);

                                                    return (
                                                        <div
                                                            key={i}
                                                            className="flex-1 max-w-[12px] min-w-[3px] rounded-t-[1px] hover:opacity-80 transition-all relative group/bar"
                                                            style={{
                                                                height: `${displayHeight}%`,
                                                                backgroundColor: getCategoryColor(cat.name)
                                                            }}
                                                        >
                                                            {/* Tooltip for individual bar */}
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/bar:block z-30 whitespace-nowrap px-2 py-1 bg-slate-900 border border-slate-700 text-[10px] text-white rounded shadow-xl">
                                                                {cat.name}: {cat.hours.toFixed(1)}h
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {/* If no data for day (placeholder for spacing) */}
                                                {sortedCategories.length === 0 && <div className="h-0 w-full" />}
                                            </div>

                                            {/* Date Label */}
                                            <div className="absolute top-full mt-2 text-[10px] text-slate-500 whitespace-nowrap origin-center">
                                                {day.date.slice(5)}
                                            </div>

                                            {/* Hover overlay for date/total tooltip (optional) */}
                                            <div className="absolute inset-x-0 bottom-0 top-1/2 opacity-0 group-hover/day:opacity-100 pointer-events-none flex justify-center items-end pb-8">
                                                <div className="px-2 py-1 bg-slate-800/90 text-[10px] text-white rounded border border-slate-700">
                                                    {day.hours.toFixed(1)}h
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div className="py-2">
                            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                                <span className="w-1 h-4 bg-sky-500 rounded-full"></span>
                                {t('codeTime.languages')}
                            </h3>
                            <div className="space-y-4">
                                {(displayStats?.languages || []).slice(0, 6).map((lang: any, index: number) => {
                                    const colors = ['#0ea5e9', '#22d3ee', '#38bdf8', '#7dd3fc', '#0284c7', '#0369a1']; // Sky/Blue colors
                                    return (
                                        <div key={index} className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-300 font-medium">{lang.name}</span>
                                                <span className="text-slate-400">{lang.text} ({lang.percent.toFixed(1)}%)</span>
                                            </div>
                                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-sky-500 rounded-full transition-all duration-500"
                                                    style={{
                                                        width: `${lang.percent}%`,
                                                        backgroundColor: colors[index % colors.length]
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                                {(!displayStats?.languages || displayStats.languages.length === 0) && (
                                    <div className="text-center text-slate-500 py-8">
                                        No language data available
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="py-2">
                            <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                                <span className="w-1 h-4 bg-pink-500 rounded-full"></span>
                                {t('codeTime.editors')}
                            </h3>
                            <div className="space-y-4">
                                {(displayStats?.editors || []).slice(0, 6).map((editor: any, index: number) => {
                                    const colors = ['#f472b6', '#ec4899', '#db2777', '#be123c', '#fbcfe8', '#9d174d']; // Pink/Rose colors
                                    return (
                                        <div key={index} className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-300 font-medium">{editor.name}</span>
                                                <span className="text-slate-400">{editor.text} ({editor.percent.toFixed(1)}%)</span>
                                            </div>
                                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-pink-500 rounded-full transition-all duration-500"
                                                    style={{
                                                        width: `${editor.percent}%`,
                                                        backgroundColor: colors[index % colors.length]
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                                {(!displayStats?.editors || displayStats.editors.length === 0) && (
                                    <div className="text-center text-slate-500 py-8">
                                        No editor data available
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
