import React from 'react';
import '../index.css';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './contexts/I18nContext';
import { ThemeProvider } from './contexts/ThemeContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// 整体化：禁用页面右键菜单（复制内容/图片另存为等入口），
// 但可编辑控件内保留右键，确保粘贴等功能不受影响
document.addEventListener('contextmenu', (event) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest('input, textarea, [contenteditable="true"]')) {
    return;
  }
  event.preventDefault();
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>
);