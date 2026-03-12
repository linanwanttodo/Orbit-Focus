import React from 'react';
import '../index.css';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './contexts/I18nContext';

// 检查URL路径，如果是/mgment，重定向到/admin/index.html
const currentPath = window.location.pathname;
if (currentPath === '/mgment' || currentPath === '/mgment/') {
  // 在开发环境中，直接重定向
  // 在生产环境中，这个路由应该由Cloudflare Workers处理
  window.location.href = '/admin/index.html';
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);