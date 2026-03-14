import React, { useState, useEffect } from 'react';

interface TitleBarProps {
    title?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ title = 'ORBIT FOCUS' }) => {
    const [isMaximized, setIsMaximized] = useState(false);
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

    useEffect(() => {
        // 获取初始窗口状态
        const initStates = async () => {
            if (window.electron) {
                try {
                    const maximized = await window.electron.windowIsMaximized?.();
                    setIsMaximized(maximized || false);

                    const alwaysOnTop = await window.electron.isAlwaysOnTop?.();
                    setIsAlwaysOnTop(alwaysOnTop || false);
                } catch (error) {
                    console.log('Not in Electron environment');
                }
            }
        };
        initStates();
    }, []);

    const handleMinimize = async () => {
        if (window.electron?.windowMinimize) {
            await window.electron.windowMinimize();
        }
    };

    const handleMaximize = async () => {
        if (window.electron?.windowMaximize) {
            const maximized = await window.electron.windowMaximize();
            setIsMaximized(maximized);
        }
    };

    const handleAlwaysOnTop = async () => {
        if (window.electron?.setAlwaysOnTop) {
            const nextState = !isAlwaysOnTop;
            const actualState = await window.electron.setAlwaysOnTop(nextState);
            setIsAlwaysOnTop(actualState);
        }
    };

    const handleClose = async () => {
        if (window.electron?.windowClose) {
            await window.electron.windowClose();
        }
    };

    return (
        <div
            className="h-9 bg-[#0B0C15] flex items-center justify-between px-3 select-none border-b border-dark-700"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            {/* 左侧：Logo和标题 */}
            <div className="flex items-center gap-2">
                <img src="./orbit-icon.png" alt="logo" className="w-5 h-5" />
                <span className="text-xs font-bold tracking-wider text-slate-300">{title}</span>
            </div>

            {/* 右侧：窗口控制按钮 */}
            <div
                className="flex items-center gap-1"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >


                {/* 最小化按钮 */}
                <button
                    onClick={handleMinimize}
                    className="w-8 h-6 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-dark-700 rounded transition-colors"
                    title="最小化"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                    </svg>
                </button>

                {/* 最大化/还原按钮 */}
                <button
                    onClick={handleMaximize}
                    className="w-8 h-6 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-dark-700 rounded transition-colors"
                    title={isMaximized ? '还原' : '最大化'}
                >
                    {isMaximized ? (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v2m0 8v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2" />
                        </svg>
                    ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <rect x="4" y="4" width="16" height="16" rx="2" />
                        </svg>
                    )}
                </button>

                {/* 关闭按钮 */}
                <button
                    onClick={handleClose}
                    className="w-8 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 rounded transition-colors"
                    title="关闭"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
