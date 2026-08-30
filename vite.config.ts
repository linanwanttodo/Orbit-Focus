import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // root 保持为项目根：index.html 与入口 /client/src/index.tsx 都在根目录下
  publicDir: 'client/public',
  server: {
    port: 5173,
    host: '0.0.0.0',
    // 系统inotify上限过低会 ENOSPC，改用轮询监听（不依赖inotify，HMR正常生效）
    watch: {
      usePolling: true,
      interval: 300,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
