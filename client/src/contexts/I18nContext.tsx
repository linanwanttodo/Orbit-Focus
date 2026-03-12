import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// 支持的语言
export type Language = 'en' | 'zh' | 'ru';

// 翻译数据接口
interface TranslationData {
  [key: string]: any;
}

// 上下文接口
interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, any>) => string;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
}

// 创建上下文
const I18nContext = createContext<I18nContextType | undefined>(undefined);

// 默认语言
const DEFAULT_LANGUAGE: Language = 'en';

// 语言映射
const LANGUAGE_MAP: Record<Language, string> = {
  en: 'English',
  zh: '中文',
  ru: 'Русский'
};

// 加载翻译文件
const loadTranslations = async (lang: Language): Promise<TranslationData> => {
  try {
    const module = await import(`../locales/${lang}.json`);
    return module.default;
  } catch (error) {
    console.error(`Failed to load translations for ${lang}:`, error);
    // 如果加载失败，尝试加载默认语言
    if (lang !== DEFAULT_LANGUAGE) {
      try {
        const module = await import(`../locales/${DEFAULT_LANGUAGE}.json`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换语言
  const setLanguage = async (lang: Language) => {
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
  };

  // 翻译函数
  const t = (key: string, params?: Record<string, any>): string => {
    const keys = key.split('.');
    let value: any = translations;

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
        return str.replace(new RegExp(`\{${paramKey}\}`, 'g'), String(paramValue));
      }, value);
    }

    return value;
  };

  // 格式化日期
  const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions): string => {
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
  };

  // 格式化时间
  const formatTime = (date: Date, options?: Intl.DateTimeFormatOptions): string => {
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
  };

  // 格式化数字
  const formatNumber = (num: number, options?: Intl.NumberFormatOptions): string => {
    let locale = 'en-US';
    if (language === 'zh') locale = 'zh-CN';
    if (language === 'ru') locale = 'ru-RU';
    return num.toLocaleString(locale, options);
  };

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">Loading translations...</div>
      </div>
    );
  }

  const contextValue: I18nContextType = {
    language,
    setLanguage,
    t,
    formatDate,
    formatTime,
    formatNumber,
  };

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

// 语言切换组件 - 下拉式选择
export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  // 语言选项
  const languageOptions = [
    { code: 'en', label: 'English', display: 'EN' },
    { code: 'zh', label: '中文', display: 'CN' },
    { code: 'ru', label: 'Русский', display: 'RU' }
  ];

  // 获取当前选中的语言
  const currentLanguage = languageOptions.find(option => option.code === language);

  // 处理语言切换
  const handleLanguageChange = (langCode: 'en' | 'zh' | 'ru') => {
    setLanguage(langCode);
    setIsOpen(false);
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.language-switcher-container')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="language-switcher-container relative">
      {/* 下拉触发器 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-slate-300 hover:text-white hover:bg-dark-800/50 transition-all border border-dark-600 hover:border-dark-500 w-[70px] justify-between"
      >
        <span>{currentLanguage?.display || 'EN'}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-[100px] bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 overflow-hidden">
          {languageOptions.map((option) => (
            <button
              key={option.code}
              onClick={() => handleLanguageChange(option.code as 'en' | 'zh' | 'ru')}
              className={`w-full text-left px-3 py-2 text-sm transition-all flex items-center justify-between ${language === option.code
                ? 'bg-brand text-white'
                : 'text-slate-300 hover:text-white hover:bg-dark-700'
                }`}
            >
              <span>{option.display}</span>
              {language === option.code && (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};