#!/usr/bin/env node

// 测试后端服务器启动
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 启动 Electron 应用...\n');

const electronPath = require('electron');
const appPath = path.join(__dirname, '..');

const electron = spawn(electronPath, [appPath], {
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: 'inherit' // 继承标准输入输出,这样能看到所有日志
});

electron.on('close', (code) => {
    console.log(`\nElectron 进程退出,代码: ${code}`);
    process.exit(code);
});

electron.on('error', (err) => {
    console.error('启动 Electron 失败:', err);
    process.exit(1);
});
