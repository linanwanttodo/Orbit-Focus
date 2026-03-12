import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 数据库文件路径 - 统一使用项目根目录的 data 文件夹
// __dirname 在编译后指向 dist-electron/server/src 或 server/dist
// 所以需要用 ../../.. 回到项目根目录
const dbPath = path.join(__dirname, '../../../data/orbit-focus.db');

// 确保 data 目录存在
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化数据库表结构
export function initializeDatabase() {
  // 创建任务表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_completed INTEGER DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 创建会话表
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('work', 'break', 'longBreak')),
      duration INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      is_completed INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 创建索引以提高查询性能
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_type ON sessions(type);
  `);

  // 创建打卡表格表
  db.exec(`
    CREATE TABLE IF NOT EXISTS check_in_sheets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // 创建单元格数据表
  db.exec(`
    CREATE TABLE IF NOT EXISTS sheet_cells (
      id TEXT PRIMARY KEY,
      sheet_id TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      col_index INTEGER NOT NULL,
      cell_type TEXT CHECK(cell_type IN ('text', 'number', 'formula', 'checkbox', 'date')),
      value TEXT,
      computed_value TEXT,
      style TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (sheet_id) REFERENCES check_in_sheets(id) ON DELETE CASCADE,
      UNIQUE(sheet_id, row_index, col_index)
    )
  `);

  // 创建看板配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS kanban_configs (
      id TEXT PRIMARY KEY,
      sheet_id TEXT NOT NULL,
      columns TEXT NOT NULL,
      card_fields TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (sheet_id) REFERENCES check_in_sheets(id) ON DELETE CASCADE
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cells_sheet ON sheet_cells(sheet_id);
    CREATE INDEX IF NOT EXISTS idx_cells_position ON sheet_cells(sheet_id, row_index, col_index);
  `);

  console.log('数据库初始化完成');
}

// 获取数据库实例
export function getDatabase(): Database.Database {
  return db;
}

// 关闭数据库连接
export function closeDatabase() {
  db.close();
}