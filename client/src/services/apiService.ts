// API服务 - 与Node.js后端API交互

// 动态获取 API 基础 URL
async function getApiBaseUrl(): Promise<string> {
  // 在 Electron 环境中,从主进程获取实际端口
  if (typeof window !== 'undefined' && (window as any).electron?.getServerPort) {
    try {
      const port = await (window as any).electron.getServerPort();
      return `http://localhost:${port}/api`;
    } catch (error) {
      console.warn('无法获取服务器端口,使用默认值:', error);
    }
  }

  // 降级:使用环境变量或默认值
  return (import.meta as any).env.VITE_API_URL || 'http://localhost:8080/api';
}

// 通用API请求函数
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const API_BASE_URL = await getApiBaseUrl();
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `请求失败: ${response.status}`);
  }

  return response;
}

// 获取用户统计
export async function getUserStats() {
  try {
    const response = await apiRequest('/sessions/stats');
    const data = await response.json();

    // 处理每日统计数据
    const dailyStats = data.dailyStats || [];
    const today = new Date().toISOString().split('T')[0];
    const todayFocus = dailyStats.find(d => d.date === today)?.work_time || 0;

    // 计算本周总时长
    const weeklyTotal = dailyStats.reduce((sum: number, day: any) => sum + (day.work_time || 0), 0);

    // 生成最近7天的数据
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      // 使用本地日期格式 YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayData = dailyStats.find(d => d.date === dateStr);
      weeklyData.push(dayData ? Math.round(dayData.work_time / 60) : 0);
    }

    // 处理热力图数据
    const heatmapData = (data.heatmapData || []).map((item: any) => ({
      date: item.date,
      work_time: item.work_time || 0,
      sessions_count: item.sessions_count || 0
    }));

    return {
      todayFocus: Math.round(todayFocus / 60),
      weeklyTotal: Math.round(weeklyTotal / 60),
      weeklyData,
      heatmapData,
      totalDuration: Math.round((data.totalDuration || 0) / 60),
      streak: data.streak || {
        current: 0,
        max: 0,
        totalDays: 0
      }
    };
  } catch (error) {
    console.error('从API获取统计数据失败:', error);
    return {
      todayFocus: 0,
      weeklyTotal: 0,
      weeklyData: Array(7).fill(0),
      heatmapData: [],
      totalDuration: 0,
      streak: {
        current: 0,
        max: 0,
        totalDays: 0
      }
    };
  }
}

// 保存会话数据
export async function saveSessionData(
  durationSeconds: number,
  startedAt: string
) {
  try {
    const response = await apiRequest('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        type: 'work',
        duration: durationSeconds,
        startTime: startedAt,
        isCompleted: true
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('保存会话数据失败:', error);
    throw error;
  }
}

// 保存任务数据
export async function saveTaskData(
  taskId: string,
  text: string,
  completed: boolean = false
) {
  try {
    let response;
    if (taskId && taskId.startsWith('task_')) {
      // 更新现有任务
      response = await apiRequest(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: text,
          description: '',
          isCompleted: completed,
        }),
      });
    } else {
      // 创建新任务
      response = await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: text,
          description: '',
          isCompleted: completed,
        }),
      });
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('保存任务数据失败:', error);
    throw error;
  }
}

// 获取任务列表
export async function getTasks() {
  try {
    const response = await apiRequest('/tasks');
    const data = await response.json();

    // 转换数据格式以匹配前端
    return (data || []).map((task: any) => ({
      id: task.id,
      text: task.title,
      completed: task.isCompleted
    }));
  } catch (error) {
    console.error('获取任务失败:', error);
    return [];
  }
}

// 删除任务
export async function deleteTask(taskId: string) {
  try {
    const response = await apiRequest(`/tasks/${taskId}`, {
      method: 'DELETE',
    });

    return response.json();
  } catch (error) {
    console.error('删除任务失败:', error);
    throw error;
  }
}

// 格式化时间（秒到分钟:秒）
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// 格式化日期（YYYY-MM-DD）
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 计算两个日期之间的天数
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
}

// 计算连续天数
export function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const sortedDates = dates.sort().reverse();
  let streak = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const currentDate = new Date(sortedDates[i]);
    const previousDate = new Date(sortedDates[i - 1]);

    const daysDiff = daysBetween(currentDate, previousDate);
    if (daysDiff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// 生成热力图数据
export function generateHeatmapData(heatmapData: any[]) {
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);

  const heatmap = {};

  heatmapData.forEach(item => {
    heatmap[item.date] = {
      activityLevel: item.activity_level,
      workTime: item.work_time,
      sessionsCount: item.sessions_count,
    };
  });

  const weeks = [];
  let currentWeek = [];

  const startDate = new Date(oneYearAgo);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    const dayOfWeek = d.getDay();

    currentWeek.push({
      date: dateStr,
      activityLevel: heatmap[dateStr]?.activityLevel || 0,
      workTime: heatmap[dateStr]?.workTime || 0,
      sessionsCount: heatmap[dateStr]?.sessionsCount || 0,
    });

    if (dayOfWeek === 6 || d >= today) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  }

  return weeks;
}

// 计算专注分数
export function calculateFocusScore(workTime: number, sessionsCount: number): number {
  let score = Math.floor(workTime / 60);
  score += sessionsCount * 5;
  return Math.min(100, score);
}