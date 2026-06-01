import { HeatmapRow, StreakData, ApiTask } from '../types';

// API服务 - 使用相对路径，与后端在同一域名下
const API_BASE_URL = '/api';

// 通用API请求函数
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
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

// 获取用户统计 — 直接使用后端返回的字段，不再重算
export async function getUserStats() {
  try {
    const response = await apiRequest('/sessions/stats');
    const data = await response.json();

    return {
      todayFocus: data.todayFocus ?? 0,
      weeklyTotal: data.weeklyTotal ?? 0,
      weeklyData: data.weeklyData ?? [0, 0, 0, 0, 0, 0, 0],
      heatmapData: (data.heatmapData ?? []) as HeatmapRow[],
      totalDuration: data.totalDuration ?? 0,
      streak: (data.streak ?? { current: 0, max: 0, totalDays: 0 }) as StreakData,
    };
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return {
      todayFocus: 0,
      weeklyTotal: 0,
      weeklyData: [0, 0, 0, 0, 0, 0, 0],
      heatmapData: [] as HeatmapRow[],
      totalDuration: 0,
      streak: { current: 0, max: 0, totalDays: 0 } as StreakData,
    };
  }
}

// 保存会话数据
export async function saveSessionData(durationSeconds: number, startedAt: string) {
  try {
    const response = await apiRequest('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        type: 'work',
        duration: durationSeconds,
        workTime: durationSeconds,
        startTime: startedAt,
        isCompleted: true,
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('保存会话失败:', error);
    throw error;
  }
}

// 保存任务数据
export async function saveTaskData(taskId: string, text: string, completed: boolean = false) {
  try {
    if (taskId && taskId.startsWith('task_')) {
      const response = await apiRequest(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: text, isCompleted: completed }),
      });
      return await response.json();
    } else {
      const response = await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: text, isCompleted: completed }),
      });
      return await response.json();
    }
  } catch (error) {
    console.error('保存任务失败:', error);
    throw error;
  }
}

// 获取任务列表
export async function getTasks(): Promise<ApiTask[]> {
  try {
    const response = await apiRequest('/tasks');
    const data = await response.json();
    return (data || []).map((task: ApiTask) => ({
      id: task.id,
      title: task.title,
      completed: task.isCompleted,
    }));
  } catch (error) {
    console.error('获取任务失败:', error);
    return [];
  }
}

// 删除任务
export async function deleteTask(taskId: string) {
  try {
    const response = await apiRequest(`/tasks/${taskId}`, { method: 'DELETE' });
    return await response.json();
  } catch (error) {
    console.error('删除任务失败:', error);
    throw error;
  }
}

// 工具函数
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
}

export function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sortedDates = dates.sort().reverse();
  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const diff = daysBetween(new Date(sortedDates[i]), new Date(sortedDates[i - 1]));
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

interface HeatmapItem {
  date: string;
  activity_level?: number;
  work_time: number;
  sessions_count: number;
}

export function generateHeatmapData(heatmapData: HeatmapItem[]) {
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);

  const heatmap: Record<string, HeatmapItem> = {};
  heatmapData.forEach(item => {
    heatmap[item.date] = item;
  });

  const weeks: HeatmapItem[][] = [];
  let currentWeek: HeatmapItem[] = [];
  const startDate = new Date(oneYearAgo);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    const dayOfWeek = d.getDay();
    currentWeek.push({
      date: dateStr,
      activity_level: heatmap[dateStr]?.activity_level || 0,
      work_time: heatmap[dateStr]?.work_time || 0,
      sessions_count: heatmap[dateStr]?.sessions_count || 0,
    });
    if (dayOfWeek === 6 || d >= today) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  }
  return weeks;
}

export function calculateFocusScore(workTime: number, sessionsCount: number): number {
  let score = Math.floor(workTime / 60);
  score += sessionsCount * 5;
  return Math.min(100, score);
}
