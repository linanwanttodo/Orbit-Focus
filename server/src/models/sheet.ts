import { getDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

export interface CheckInSheet {
    id: string;
    title: string;
    description?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SheetCell {
    id: string;
    sheetId: string;
    rowIndex: number;
    colIndex: number;
    cellType: 'text' | 'number' | 'formula' | 'checkbox' | 'date';
    value: string;
    computedValue?: string;
    style?: string; // JSON string
    createdAt: string;
    updatedAt: string;
}

export interface KanbanConfig {
    id: string;
    sheetId: string;
    columns: string; // JSON string
    cardFields: string; // JSON string
    createdAt: string;
    updatedAt: string;
}

// 获取所有表格
export function getAllSheets(): CheckInSheet[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM check_in_sheets ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
}

// 创建新表格
export function createSheet(title: string, description?: string): CheckInSheet {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
    INSERT INTO check_in_sheets (id, title, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

    stmt.run(id, title, description || '', now, now);

    return {
        id,
        title,
        description,
        createdAt: now,
        updatedAt: now
    };
}

// 更新表格
export function updateSheet(id: string, title?: string, description?: string): CheckInSheet | null {
    const db = getDatabase();
    const now = new Date().toISOString();

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
    }

    if (updates.length === 0) return null;

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    const stmt = db.prepare(`UPDATE check_in_sheets SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    const getStmt = db.prepare('SELECT * FROM check_in_sheets WHERE id = ?');
    const row = getStmt.get(id) as any;

    if (!row) return null;

    return {
        id: row.id,
        title: row.title,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

// 删除表格
export function deleteSheet(id: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM check_in_sheets WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
}

// 获取表格的所有单元格
export function getSheetCells(sheetId: string): SheetCell[] {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM sheet_cells WHERE sheet_id = ? ORDER BY row_index, col_index');
    const rows = stmt.all(sheetId) as any[];

    return rows.map(row => ({
        id: row.id,
        sheetId: row.sheet_id,
        rowIndex: row.row_index,
        colIndex: row.col_index,
        cellType: row.cell_type,
        value: row.value,
        computedValue: row.computed_value,
        style: row.style,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));
}

// 批量更新单元格
export function batchUpdateCells(sheetId: string, cells: Partial<SheetCell>[]): void {
    const db = getDatabase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
    INSERT INTO sheet_cells (id, sheet_id, row_index, col_index, cell_type, value, computed_value, style, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sheet_id, row_index, col_index) 
    DO UPDATE SET 
      cell_type = excluded.cell_type,
      value = excluded.value,
      computed_value = excluded.computed_value,
      style = excluded.style,
      updated_at = excluded.updated_at
  `);

    const transaction = db.transaction((cellsToUpdate: Partial<SheetCell>[]) => {
        for (const cell of cellsToUpdate) {
            const id = cell.id || uuidv4();
            stmt.run(
                id,
                sheetId,
                cell.rowIndex,
                cell.colIndex,
                cell.cellType || 'text',
                cell.value || '',
                cell.computedValue || '',
                cell.style || '',
                now,
                now
            );
        }
    });

    transaction(cells);
}

// 获取看板配置
export function getKanbanConfig(sheetId: string): KanbanConfig | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM kanban_configs WHERE sheet_id = ?');
    const row = stmt.get(sheetId) as any;

    if (!row) return null;

    return {
        id: row.id,
        sheetId: row.sheet_id,
        columns: row.columns,
        cardFields: row.card_fields,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

// 更新看板配置
export function updateKanbanConfig(sheetId: string, columns: string, cardFields: string): KanbanConfig {
    const db = getDatabase();
    const now = new Date().toISOString();

    // 先尝试获取现有配置
    const existing = getKanbanConfig(sheetId);

    if (existing) {
        const stmt = db.prepare(`
      UPDATE kanban_configs 
      SET columns = ?, card_fields = ?, updated_at = ?
      WHERE sheet_id = ?
    `);
        stmt.run(columns, cardFields, now, sheetId);

        return {
            id: existing.id,
            sheetId,
            columns,
            cardFields,
            createdAt: existing.createdAt,
            updatedAt: now
        };
    } else {
        const id = uuidv4();
        const stmt = db.prepare(`
      INSERT INTO kanban_configs (id, sheet_id, columns, card_fields, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, sheetId, columns, cardFields, now, now);

        return {
            id,
            sheetId,
            columns,
            cardFields,
            createdAt: now,
            updatedAt: now
        };
    }
}
