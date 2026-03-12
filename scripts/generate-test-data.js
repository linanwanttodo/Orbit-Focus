// 测试数据生成脚本 - 简化版
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 使用项目的数据目录
const dbPath = path.join(__dirname, '../data/orbit-focus.db');
const db = new Database(dbPath);

console.log('数据库路径:', dbPath);

// 生成测试数据
function generateTestData() {
    const now = new Date('2026-01-18T18:00:00');

    // 生成近7天的数据
    console.log('\n生成近7天的会话数据...');
    for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        // 每天生成2-5个会话
        const sessionCount = Math.floor(Math.random() * 4) + 2;
        let dailyTotal = 0;

        for (let j = 0; j < sessionCount; j++) {
            const duration = Math.floor(Math.random() * 1500) + 600; // 10-35分钟(秒)
            dailyTotal += duration;

            const startTime = new Date(date);
            startTime.setHours(9 + Math.floor(Math.random() * 10));
            startTime.setMinutes(Math.floor(Math.random() * 60));

            const endTime = new Date(startTime.getTime() + duration * 1000);

            const id = uuidv4();
            const createdAt = startTime.toISOString();

            db.prepare(`
        INSERT INTO sessions (id, type, duration, start_time, end_time, is_completed, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
                id,
                'work',
                duration,
                startTime.toISOString(),
                endTime.toISOString(),
                1,
                createdAt,
                createdAt
            );
        }

        const minutes = Math.floor(dailyTotal / 60);
        console.log(`${date.toISOString().split('T')[0]}: ${sessionCount} 个会话, ${minutes} 分钟`);
    }

    // 生成过去一年的数据(稀疏分布,用于热力图)
    console.log('\n生成全年热力图数据...');
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    let totalDays = 0;
    const currentDate = new Date(oneYearAgo);

    while (currentDate <= now) {
        // 30% 的概率有数据
        if (Math.random() > 0.7) {
            const sessionCount = Math.floor(Math.random() * 3) + 1;

            for (let j = 0; j < sessionCount; j++) {
                const duration = Math.floor(Math.random() * 2000) + 300;
                const startTime = new Date(currentDate);
                startTime.setHours(9 + Math.floor(Math.random() * 10));

                const endTime = new Date(startTime.getTime() + duration * 1000);

                const id = uuidv4();
                const createdAt = startTime.toISOString();

                db.prepare(`
          INSERT INTO sessions (id, type, duration, start_time, end_time, is_completed, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
                    id,
                    'work',
                    duration,
                    startTime.toISOString(),
                    endTime.toISOString(),
                    1,
                    createdAt,
                    createdAt
                );
            }
            totalDays++;
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`\n生成了 ${totalDays} 天的历史数据`);

    // 统计总数据
    const count = db.prepare('SELECT COUNT(*) as count FROM sessions').get();
    console.log(`\n数据库中共有 ${count.count} 条会话记录`);

    // 显示近7天统计
    console.log('\n近7天统计:');
    const stats = db.prepare(`
    SELECT 
      DATE(start_time) as date,
      COUNT(*) as sessions,
      SUM(duration) as total_seconds
    FROM sessions
    WHERE DATE(start_time) >= DATE('2026-01-11')
    GROUP BY DATE(start_time)
    ORDER BY date DESC
  `).all();

    stats.forEach(stat => {
        const minutes = Math.floor(stat.total_seconds / 60);
        console.log(`${stat.date}: ${stat.sessions} 个会话, ${minutes} 分钟`);
    });
}

// 执行
try {
    generateTestData();
    console.log('\n✅ 测试数据生成完成!');
    console.log('请刷新统计页面查看效果。');
} catch (error) {
    console.error('❌ 生成测试数据失败:', error);
} finally {
    db.close();
}
