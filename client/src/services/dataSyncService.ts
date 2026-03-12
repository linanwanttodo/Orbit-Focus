// 数据同步服务 - 直接与后端 SQLite 数据库交互
import { saveSessionData as saveSessionToAPI, saveTaskData as saveTaskToAPI } from './apiService';

// 保存会话数据到后端
export async function saveSessionData(
  durationSeconds: number,
  startedAt: string
): Promise<void> {
  try {
    await saveSessionToAPI(durationSeconds, startedAt);
  } catch (error) {
    console.error('保存会话数据失败:', error);
    throw error;
  }
}

// 保存任务数据到后端
export async function saveTaskData(
  taskId: string,
  text: string,
  completed: boolean = false
): Promise<void> {
  try {
    await saveTaskToAPI(taskId, text, completed);
  } catch (error) {
    console.error('保存任务数据失败:', error);
    throw error;
  }
}

// 获取本地任务（从 localStorage 作为后备）
export function getLocalTasks(): any[] {
  try {
    const tasksJson = localStorage.getItem('orbit-timer-tasks');
    return tasksJson ? JSON.parse(tasksJson) : [];
  } catch (error) {
    console.error('获取本地任务数据失败:', error);
    return [];
  }
}

// 保存任务到本地（作为后备）
export function saveTaskToLocal(task: any): void {
  try {
    const tasks = getLocalTasks();
    const existingIndex = tasks.findIndex((t: any) => t.id === task.id);

    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }

    localStorage.setItem('orbit-timer-tasks', JSON.stringify(tasks));
  } catch (error) {
    console.error('保存任务到本地失败:', error);
  }
}

// 检查是否有未同步的数据（现在不需要了，直接返回 false）
export function hasUnsyncedData(): boolean {
  return false;
}