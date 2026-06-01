import { getDatabase } from '../database';

export interface TaskData {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

interface TaskCreateData {
  title: string;
  description?: string;
  isCompleted?: boolean;
  orderIndex?: number;
}

export class Task {
  static create(data: TaskCreateData): TaskData {
    const db = getDatabase();
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO tasks (id, title, description, is_completed, order_index, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.title,
      data.description || '',
      data.isCompleted ? 1 : 0,
      data.orderIndex || 0,
      now,
      now
    );

    return {
      id,
      title: data.title,
      description: data.description || '',
      isCompleted: data.isCompleted || false,
      orderIndex: data.orderIndex || 0,
      createdAt: now,
      updatedAt: now
    };
  }

  static findById(id: string): TaskData | undefined {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return undefined;

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      isCompleted: row.is_completed === 1,
      orderIndex: row.order_index,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static getAll(): TaskData[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM tasks ORDER BY order_index ASC, created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      isCompleted: row.is_completed === 1,
      orderIndex: row.order_index,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  static update(id: string, data: Partial<TaskCreateData>): TaskData | undefined {
    const db = getDatabase();
    const now = new Date().toISOString();

    const updates: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.isCompleted !== undefined) {
      updates.push('is_completed = ?');
      params.push(data.isCompleted ? 1 : 0);
    }
    if (data.orderIndex !== undefined) {
      updates.push('order_index = ?');
      params.push(data.orderIndex);
    }

    if (updates.length === 0) return this.findById(id);

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = db.prepare(`
      UPDATE tasks
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...params);

    return this.findById(id);
  }

  static delete(id: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}