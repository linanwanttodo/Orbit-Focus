import assert from 'node:assert/strict';
import test from 'node:test';
import { maskConnectionString, toPositionalParams } from '../server/src/database';

test('rewrites SQLite placeholders into positional parameters in order', () => {
  assert.equal(
    toPositionalParams('INSERT INTO tasks (id, user_id, title) VALUES (?, ?, ?)'),
    'INSERT INTO tasks (id, user_id, title) VALUES ($1, $2, $3)'
  );
  assert.equal(toPositionalParams('SELECT ? AS first, ? AS second'), 'SELECT $1 AS first, $2 AS second');
});

test('leaves question marks inside string literals alone', () => {
  assert.equal(
    toPositionalParams("SELECT * FROM tasks WHERE title = '5 ?' AND user_id = ?"),
    "SELECT * FROM tasks WHERE title = '5 ?' AND user_id = $1"
  );
});

test('keeps counting straight across escaped quotes', () => {
  assert.equal(
    toPositionalParams("UPDATE sessions SET note = 'it''s ?' WHERE id = ? AND user_id = ?"),
    "UPDATE sessions SET note = 'it''s ?' WHERE id = $1 AND user_id = $2"
  );
});

test('passes through statements that carry no placeholders', () => {
  const ddl = 'CREATE TABLE IF NOT EXISTS users (id TEXT NOT NULL, login TEXT NOT NULL, PRIMARY KEY (id))';
  assert.equal(toPositionalParams(ddl), ddl);
  const upsert =
    'INSERT INTO users (id, login) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET login = excluded.login';
  assert.equal(
    toPositionalParams(upsert),
    'INSERT INTO users (id, login) VALUES ($1, $2) ON CONFLICT(id) DO UPDATE SET login = excluded.login'
  );
  assert.equal(toPositionalParams(''), '');
});

test('numbers one placeholder per bound value on a real upsert shape', () => {
  const sql =
    'INSERT INTO countdowns (id, user_id, title, target_date, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT (user_id, id) DO UPDATE SET title = excluded.title, target_date = excluded.target_date';
  const params = ['cd_1', 'user-1', 'Exam', '2026-10-01T00:00', 'now', 'now'];
  const rewritten = toPositionalParams(sql);
  assert.equal((rewritten.match(/\$\d+/g) || []).length, params.length);
  assert.equal(rewritten.indexOf('?'), -1);
});

test('never echoes a database password into startup logs', () => {
  const masked = maskConnectionString('postgres://orbit:super-secret@db.internal:5432/orbit_focus');
  assert.doesNotMatch(masked, /super-secret/);
  assert.match(masked, /db\.internal:5432\/orbit_focus/);

  const keywordValue = maskConnectionString('host=db.internal dbname=orbit_focus password=super-secret');
  assert.doesNotMatch(keywordValue, /super-secret/);

  const credentialless = 'postgres://db.internal:5432/orbit_focus';
  assert.equal(maskConnectionString(credentialless), credentialless);
});
