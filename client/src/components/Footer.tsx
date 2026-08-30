import React from 'react';

// GitHub octocat 标志（fill 路径）
const GitHubIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

// Gitee 标志（fill 路径）
const GiteeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.98 0-1.778.798-1.778 1.778v7.274c0 .327.266.592.593.592h5.847c.98 0 1.778-.798 1.778-1.778v-.296a.593.593 0 0 0-.592-.592h-4.19a.592.592 0 0 1-.593-.593v-1.482a.593.593 0 0 1 .592-.592h6.977c.327 0 .593.265.593.592v3.409a4.193 4.193 0 0 1-4.193 4.193H7.483A.593.593 0 0 1 6.89 18.89V9.778a4.444 4.444 0 0 1 4.444-4.444h6.74z" />
  </svg>
);

// 信封图标（stroke 风格）
const MailIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const footerLinks = [
  { label: 'Email', href: 'mailto:Linanwanttodo@gmail.com', Icon: MailIcon },
  { label: 'GitHub', href: 'https://github.com/linanwanttodo', Icon: GitHubIcon },
  { label: 'Gitee', href: 'https://gitee.com/linanwanttodo', Icon: GiteeIcon },
];

// 全站固定底栏：图标在上、版权文字收尾（主流极简页脚做法），不随内容滚动
export const Footer: React.FC = () => {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 bg-gh-canvas">
      <div className="flex flex-col items-center gap-1.5 py-3">
        <div className="flex items-center justify-center gap-4">
          {footerLinks.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target={href.startsWith('mailto:') ? undefined : '_blank'}
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              className="text-gh-muted hover:text-gh-fg transition-colors"
            >
              <Icon className="h-5 w-5" />
            </a>
          ))}
        </div>
        <p className="text-xs text-gh-subtle">©2026 linanwanttodo. All rights reserved.</p>
      </div>
    </footer>
  );
};
