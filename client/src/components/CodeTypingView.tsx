import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '../contexts/I18nContext';

// 支持的语言列表
const SUPPORTED_LANGUAGES = [
    { id: 'javascript', name: 'JavaScript', ext: 'js' },
    { id: 'typescript', name: 'TypeScript', ext: 'ts' },
    { id: 'python', name: 'Python', ext: 'py' },
    { id: 'java', name: 'Java', ext: 'java' },
    { id: 'c', name: 'C', ext: 'c' },
    { id: 'cpp', name: 'C++', ext: 'cpp' },
    { id: 'rust', name: 'Rust', ext: 'rs' },
    { id: 'go', name: 'Go', ext: 'go' },
    { id: 'lua', name: 'Lua', ext: 'lua' },
];

// 统计卡片配色移除霓虹效果，使用统一的暗色调基准
const STAT_COLORS = {
    wpm: { bg: 'bg-dark-800/80', text: 'text-slate-300', border: 'border-dark-700/50' },
    accuracy: { bg: 'bg-dark-800/80', text: 'text-slate-300', border: 'border-dark-700/50' },
    time: { bg: 'bg-dark-800/80', text: 'text-slate-300', border: 'border-dark-700/50' },
    progress: { bg: 'bg-dark-800/80', text: 'text-slate-300', border: 'border-dark-700/50' }
};

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    colorKey: keyof typeof STAT_COLORS;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, colorKey }) => {
    const colors = STAT_COLORS[colorKey];
    return (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${colors.border} bg-dark-800/30`}>
            <div className={`size-10 rounded-lg ${colors.bg} border border-dark-700/30 flex items-center justify-center ${colors.text}`}>
                {icon}
            </div>
            <div>
                <div className="text-slate-500 text-xs tracking-wider">{label}</div>
                <div className="text-slate-200 text-xl font-medium font-mono">{value}</div>
            </div>
        </div>
    );
};

// 解析 txt 文件：用 3 个空行分隔代码片段
const parseTxtSnippets = (content: string): string[] => {
    // 按 3 个或更多空行分隔
    const snippets = content.split(/\n{4,}/).map(s => s.trim()).filter(s => s.length > 0);
    return snippets;
};

export const CodeTypingView: React.FC = () => {
    const { t } = useI18n();
    const [currentLanguage, setCurrentLanguage] = useState('javascript');
    const [snippets, setSnippets] = useState<string[]>([]);
    const [snippetIndex, setSnippetIndex] = useState(0);
    const [userInput, setUserInput] = useState('');
    const [startTime, setStartTime] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [errors, setErrors] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 动态加载语言代码片段
    const loadSnippets = useCallback(async (language: string) => {
        setIsLoading(true);
        try {
            // 尝试加载 txt 文件
            const response = await fetch(`/src/snippets/${language}.txt`);
            if (response.ok) {
                const text = await response.text();
                const parsed = parseTxtSnippets(text);
                if (parsed.length > 0) {
                    setSnippets(parsed);
                    setSnippetIndex(0);
                    resetState();
                    setIsLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.log(`txt 文件加载失败，尝试 json: ${e}`);
        }

        // 回退到 JSON 格式
        try {
            const module = await import(`../snippets/${language}.json`);
            const data = module.default || module;
            const codes = data.map((item: any) => item.code);
            setSnippets(codes);
            setSnippetIndex(0);
            resetState();
        } catch (error) {
            console.error(`无法加载 ${language} 代码片段:`, error);
            setSnippets([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 初始加载
    useEffect(() => {
        loadSnippets(currentLanguage);
    }, [currentLanguage, loadSnippets]);

    const targetCode = snippets[snippetIndex] || '';

    // 重置状态
    const resetState = useCallback(() => {
        setUserInput('');
        setStartTime(null);
        setEndTime(null);
        setErrors(0);
        setIsFinished(false);
        setElapsedTime(0);
    }, []);

    // 计算统计数据
    const calculateWPM = useCallback(() => {
        if (!startTime || userInput.length === 0) return 0;
        const timeInMinutes = elapsedTime / 60;
        if (timeInMinutes === 0) return 0;
        const words = userInput.length / 5;
        return Math.round(words / timeInMinutes);
    }, [startTime, userInput.length, elapsedTime]);

    const calculateAccuracy = useCallback(() => {
        if (userInput.length === 0) return 100;
        const correctChars = userInput.length - errors;
        return Math.round((correctChars / userInput.length) * 100);
    }, [userInput.length, errors]);

    const calculateProgress = useCallback(() => {
        if (targetCode.length === 0) return 0;
        return Math.round((userInput.length / targetCode.length) * 100);
    }, [userInput.length, targetCode.length]);

    // 计时器
    useEffect(() => {
        let interval: number | null = null;
        if (startTime && !endTime) {
            interval = window.setInterval(() => {
                setElapsedTime((Date.now() - startTime) / 1000);
            }, 100);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [startTime, endTime]);

    // 处理输入
    const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;

        if (!startTime && value.length > 0) {
            setStartTime(Date.now());
        }

        if (value.length > userInput.length) {
            const newChar = value[value.length - 1];
            const expectedChar = targetCode[value.length - 1];
            if (newChar !== expectedChar) {
                setErrors(prev => prev + 1);
            }
        }

        setUserInput(value);

        if (value.length >= targetCode.length) {
            setEndTime(Date.now());
            setIsFinished(true);
        }
    }, [startTime, userInput.length, targetCode]);

    // 换新代码片段
    const newChallenge = useCallback(() => {
        const nextIndex = (snippetIndex + 1) % snippets.length;
        setSnippetIndex(nextIndex);
        resetState();
        inputRef.current?.focus();
    }, [snippetIndex, snippets.length, resetState]);

    // 重新开始当前片段
    const restart = useCallback(() => {
        resetState();
        inputRef.current?.focus();
    }, [resetState]);

    // 切换语言
    const changeLanguage = useCallback((language: string) => {
        setCurrentLanguage(language);
    }, []);

    // 键盘快捷键
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                newChallenge();
            } else if (e.key === 'Escape') {
                restart();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [newChallenge, restart]);

    // 点击容器时聚焦输入框
    const handleContainerClick = () => {
        inputRef.current?.focus();
    };

    // 渲染代码，带高亮
    const renderCode = () => {
        if (!targetCode) return null;

        const lines = targetCode.split('\n');
        let charIndex = 0;

        return lines.map((line, lineIndex) => {
            const chars = line.split('').map((char, i) => {
                const globalIndex = charIndex + i;
                let className = 'text-slate-600';

                if (globalIndex < userInput.length) {
                    if (userInput[globalIndex] === char) {
                        className = 'text-slate-400';
                    } else {
                        className = 'text-red-400 bg-red-500/10 rounded-[2px]';
                    }
                } else if (globalIndex === userInput.length) {
                    className = 'text-slate-600 border-b-2 border-slate-400';
                }

                return (
                    <span key={i} className={className}>
                        {char}
                    </span>
                );
            });

            if (lineIndex < lines.length - 1) {
                const newlineIndex = charIndex + line.length;
                let newlineClass = 'text-slate-600';
                if (newlineIndex < userInput.length) {
                    if (userInput[newlineIndex] === '\n') {
                        newlineClass = 'text-slate-400';
                    } else {
                        newlineClass = 'text-red-400 bg-red-500/10 rounded-[2px]';
                    }
                } else if (newlineIndex === userInput.length) {
                    newlineClass = 'border-b-2 border-slate-400';
                }
                chars.push(<span key="newline" className={newlineClass}>{' '}</span>);
            }

            charIndex += line.length + 1;

            return (
                <div key={lineIndex} className="flex">
                    <span className="text-slate-600 w-8 text-right mr-4 select-none">{lineIndex + 1}</span>
                    <span className="flex-1">{chars}</span>
                </div>
            );
        });
    };

    const wpm = calculateWPM();
    const accuracy = calculateAccuracy();
    const progress = calculateProgress();

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* 标题和操作栏 */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white">{t('codeTyping.title') || '代码打字测速'}</h2>
                            <p className="text-slate-500 text-sm mt-1">{t('codeTyping.subtitle') || '提升编程输入效率'}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={newChallenge}
                                className="px-4 py-2 rounded-lg bg-dark-700 text-slate-300 hover:bg-dark-600 hover:text-white transition-colors text-sm font-medium flex items-center gap-2"
                            >
                                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {t('codeTyping.newChallenge') || '新挑战'}
                            </button>
                        </div>
                    </div>

                    {/* 语言选择器 */}
                    <div className="flex flex-wrap gap-2">
                        {SUPPORTED_LANGUAGES.map((lang) => (
                            <button
                                key={lang.id}
                                onClick={() => changeLanguage(lang.id)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentLanguage === lang.id
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-dark-700 text-slate-400 hover:bg-dark-600 hover:text-slate-200'
                                    }`}
                            >
                                {lang.name}
                            </button>
                        ))}
                    </div>

                    {/* 统计卡片 */}
                    <div className="grid grid-cols-4 gap-4">
                        <StatCard
                            colorKey="wpm"
                            label={t('codeTyping.wpm') || 'WPM'}
                            value={wpm}
                            icon={
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            }
                        />
                        <StatCard
                            colorKey="accuracy"
                            label={t('codeTyping.accuracy') || '准确率'}
                            value={`${accuracy}%`}
                            icon={
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        />
                        <StatCard
                            colorKey="time"
                            label={t('codeTyping.time') || '时间'}
                            value={`${elapsedTime.toFixed(1)}s`}
                            icon={
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        />
                        <StatCard
                            colorKey="progress"
                            label={t('codeTyping.progress') || '进度'}
                            value={`${Math.min(progress, 100)}%`}
                            icon={
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            }
                        />
                    </div>

                    {/* 代码片段信息 */}
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-600">
                            {snippetIndex + 1} / {snippets.length} 个片段
                        </span>
                    </div>

                    {/* 代码显示区 */}
                    <div
                        ref={containerRef}
                        onClick={handleContainerClick}
                        className="relative p-6 rounded-2xl border border-dark-700 bg-dark-800/40 cursor-text min-h-[200px]"
                    >
                        {/* 加载状态 */}
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-dark-900/50 rounded-2xl">
                                <div className="text-slate-400">{t('common.loading') || '加载中...'}</div>
                            </div>
                        )}

                        {/* 完成提示 */}
                        {isFinished && (
                            <div className="absolute inset-0 bg-dark-900/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                                <div className="text-center">
                                    <div className="text-emerald-500 text-4xl font-bold mb-2">🎉</div>
                                    <div className="text-white text-xl font-bold mb-1">{t('codeTyping.completed') || '完成!'}</div>
                                    <div className="text-slate-400 text-sm mb-4">
                                        WPM: {wpm} | {t('codeTyping.accuracy') || '准确率'}: {accuracy}%
                                    </div>
                                    <button
                                        onClick={newChallenge}
                                        className="px-6 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-medium"
                                    >
                                        {t('codeTyping.nextChallenge') || '下一题'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 代码内容 */}
                        {!isLoading && snippets.length > 0 ? (
                            <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
                                {renderCode()}
                            </pre>
                        ) : !isLoading ? (
                            <div className="text-slate-500 text-center py-8">
                                {t('codeTyping.noSnippets') || '该语言暂无代码片段'}
                            </div>
                        ) : null}

                        {/* 隐藏的输入框 */}
                        <textarea
                            ref={inputRef}
                            value={userInput}
                            onChange={handleInput}
                            className="absolute opacity-0 pointer-events-none"
                            autoFocus
                            disabled={isFinished || isLoading}
                        />
                    </div>

                    {/* 快捷键提示 */}
                    <div className="flex items-center justify-center gap-8 py-4 rounded-xl bg-dark-800/30 border border-dark-700/50">
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <kbd className="px-2 py-1 rounded bg-dark-700 text-slate-400 font-mono text-xs">Tab</kbd>
                            <span>{t('codeTyping.tabHint') || '换题'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <kbd className="px-2 py-1 rounded bg-dark-700 text-slate-400 font-mono text-xs">Esc</kbd>
                            <span>{t('codeTyping.escHint') || '重新开始'}</span>
                        </div>
                    </div>

                    {/* 自定义提示 */}
                    <div className="text-center text-slate-600 text-xs">
                        {t('codeTyping.customHint') || '在 client/src/snippets/ 目录添加 .txt 文件（代码片段用 3 个空行分隔）'}
                    </div>
                </div>
            </div>
        </div>
    );
};
