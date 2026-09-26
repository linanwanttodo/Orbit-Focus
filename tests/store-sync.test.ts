import assert from 'node:assert/strict';
import test from 'node:test';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test('reports cloud task sync failures instead of silently swallowing them', async () => {
  const storage = new MemoryStorage();
  storage.setItem('orbit-focus-token', 'test-token');
  const previousStorage = globalThis.localStorage;
  const previousFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'network down' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const { syncTasks } = await import(`../client/src/services/store?sync-test=${Date.now()}`);
    const result = await syncTasks([], [{
      id: 'task-1',
      text: 'Persist me',
      completed: false,
      description: '',
      status: 'todo',
      orderIndex: 0,
    }]);

    assert.equal(result.ok, false);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /Task cloud save failed/);
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: previousStorage, configurable: true });
    globalThis.fetch = previousFetch;
  }
});
