import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback, ReactNode } from 'react';
import { Menu, Check } from 'lucide-react';

// 支持的语言
export type Language = 'en' | 'zh' | 'ru';

// 翻译数据接口 - nested record for JSON locale files
interface TranslationData {
  [key: string]: string | TranslationData;
}

// 上下文接口
interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
}

// 创建上下文
const I18nContext = createContext<I18nContextType | undefined>(undefined);

// 默认语言
const DEFAULT_LANGUAGE: Language = 'en';

// 语言映射

// 加载翻译文件
const loadTranslations = async (lang: Language): Promise<TranslationData> => {
  try {
    const module = await import(`../locales/${lang}.json`) as { default: TranslationData };
    return module.default;
  } catch (error) {
    console.error(`Failed to load translations for ${lang}:`, error);
    // 如果加载失败，尝试加载默认语言
    if (lang !== DEFAULT_LANGUAGE) {
      try {
        const module = await import(`../locales/${DEFAULT_LANGUAGE}.json`) as { default: TranslationData };
        return module.default;
      } catch (fallbackError) {
        console.error(`Failed to load fallback translations:`, fallbackError);
        return {};
      }
    }
    return {};
  }
};

// 提供者组件属性
interface I18nProviderProps {
  children: ReactNode;
  defaultLanguage?: Language;
}

// 提供者组件
export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  defaultLanguage = DEFAULT_LANGUAGE
}) => {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);
  const [translations, setTranslations] = useState<TranslationData>({});
  const [isLoading, setIsLoading] = useState(true);

  // 初始化语言
  useEffect(() => {
    const initLanguage = () => {
      // 1. 检查localStorage中保存的语言偏好
      const savedLang = localStorage.getItem('preferredLanguage') as Language;
      if (savedLang && (savedLang === 'en' || savedLang === 'zh' || savedLang === 'ru')) {
        setLanguageState(savedLang);
        return savedLang;
      }

      // 2. 检查浏览器语言
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('zh')) {
        setLanguageState('zh');
        return 'zh';
      } else if (browserLang.startsWith('ru')) {
        setLanguageState('ru');
        return 'ru';
      }

      // 3. 使用默认语言
      setLanguageState(defaultLanguage);
      return defaultLanguage;
    };

    const lang = initLanguage();
    loadTranslations(lang).then(data => {
      setTranslations(data);
      setIsLoading(false);
    });
  }, [defaultLanguage]);

  // 切换语言（useCallback 保持引用稳定，避免消费者 useEffect 无限重建）
  const setLanguage = useCallback(async (lang: Language) => {
    if (lang === language) return;

    setIsLoading(true);
    try {
      const newTranslations = await loadTranslations(lang);
      setTranslations(newTranslations);
      setLanguageState(lang);
      localStorage.setItem('preferredLanguage', lang);
    } catch (error) {
      console.error(`Failed to switch to language ${lang}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  // 翻译函数
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: string | TranslationData = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // 如果找不到翻译，返回键名
        return key;
      }
    }

    if (typeof value !== 'string') {
      return key;
    }

    // 替换参数
    if (params) {
      return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
        return str.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
      }, value);
    }

    return value;
  }, [translations]);

  // 格式化日期
  const formatDate = useCallback((date: Date, options?: Intl.DateTimeFormatOptions): string => {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };

    let locale = 'en-US';
    if (language === 'zh') locale = 'zh-CN';
    if (language === 'ru') locale = 'ru-RU';

    return date.toLocaleDateString(locale, {
      ...defaultOptions,
      ...options,
    });
  }, [language]);

  // 格式化时间
  const formatTime = useCallback((date: Date, options?: Intl.DateTimeFormatOptions): string => {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    };

    let locale = 'en-US';
    if (language === 'zh') locale = 'zh-CN';
    if (language === 'ru') locale = 'ru-RU';

    return date.toLocaleTimeString(locale, {
      ...defaultOptions,
      ...options,
    });
  }, [language]);

  // 格式化数字
  const formatNumber = useCallback((num: number, options?: Intl.NumberFormatOptions): string => {
    let locale = 'en-US';
    if (language === 'zh') locale = 'zh-CN';
    if (language === 'ru') locale = 'ru-RU';
    return num.toLocaleString(locale, options);
  }, [language]);

  const contextValue = useMemo<I18nContextType>(
    () => ({
      language,
      setLanguage,
      t,
      formatDate,
      formatTime,
      formatNumber,
    }),
    [language, setLanguage, t, formatDate, formatTime, formatNumber]
  );

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gh-muted">Loading...</div>
      </div>
    );
  }

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
};

// 自定义钩子
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

// 语言切换组件
// 桌面端（≥sm）：分段按钮胶囊；移动端（<sm）：地球图标 + 下拉菜单，避免与导航争宽溢出
export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useI18n();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const options = [
    { code: 'en' as const, label: 'English' },
    { code: 'zh' as const, label: '中文' },
    { code: 'ru' as const, label: 'Русский' },
  ];

  // 关闭：点击菜单外部或按 Esc
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      {/* 汉堡菜单按钮：桌面与移动共用 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Language"
        title="Language"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-gh-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[8.5rem] rounded-xl border border-gh-border bg-gh-surface py-1.5 animate-in fade-in duration-150"
        >
          {options.map((option) => (
            <button
              key={option.code}
              type="button"
              role="menuitem"
              onClick={() => {
                setLanguage(option.code);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-sm ${
                option.code === language
                  ? 'bg-gh-inset font-medium text-gh-fg'
                  : 'text-gh-muted'
              }`}
            >
              {option.label}
              {option.code === language && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};