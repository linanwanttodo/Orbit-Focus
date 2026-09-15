import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { CountdownItem } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { deleteCountdown, listCountdowns, saveCountdown } from '../services/store';
import { Button } from './ui/button';
import { Input } from './ui/input';

const DAY_MS = 24 * 60 * 60 * 1000;

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface CountdownProgress {
  kind: 'remaining' | 'passed' | 'today';
  days: number;
}

function countdownProgress(targetDate: string, now: Date): CountdownProgress {
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) {
    return { kind: 'today', days: 0 };
  }
  if (localDateString(target) === localDateString(now)) {
    return { kind: 'today', days: 0 };
  }
  const diff = target.getTime() - now.getTime();
  if (diff > 0) {
    return { kind: 'remaining', days: Math.ceil(diff / DAY_MS) };
  }
  return { kind: 'passed', days: Math.floor(-diff / DAY_MS) };
}

// The current view refreshes once per minute; enough for day-granularity.
function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function formatTargetDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

const CountdownPage: React.FC = () => {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const now = useMinuteTick();

  const [items, setItems] = useState<CountdownItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDate, setEditDate] = useState('');

  const locale = language === 'zh' ? 'zh-CN' : language === 'ru' ? 'ru-RU' : 'en-US';

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await listCountdowns());
    } catch (err) {
      console.error('Failed to load countdowns:', err);
      setError(err instanceof Error ? err.message : t('countdown.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload, user]);

  const sortedItems = useMemo(() => {
    const rank = (item: CountdownItem): number => countdownProgress(item.targetDate, now).kind === 'passed' ? 1 : 0;
    return [...items].sort((a, b) => {
      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;
      const timeA = new Date(a.targetDate).getTime();
      const timeB = new Date(b.targetDate).getTime();
      if (rank(a) === 1) return timeB - timeA;
      return timeA - timeB;
    });
  }, [items, now]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title || !newDate) {
      setError(t('countdown.invalidInput'));
      return;
    }
    const item: CountdownItem = {
      id: `cd_${crypto.randomUUID()}`,
      title,
      targetDate: newDate,
    };
    setItems((prev) => [...prev, item]);
    setNewTitle('');
    setNewDate('');
    setError(null);
    try {
      await saveCountdown(item);
    } catch (err) {
      console.error('Failed to save countdown:', err);
      setError(err instanceof Error ? err.message : t('countdown.loadFailed'));
      void reload();
    }
  };

  const startEdit = (item: CountdownItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDate(item.targetDate.slice(0, 16));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditDate('');
  };

  const confirmEdit = async () => {
    if (!editingId) return;
    const title = editTitle.trim();
    if (!title || !editDate) {
      setError(t('countdown.invalidInput'));
      return;
    }
    const updated: CountdownItem = { ...items.find((c) => c.id === editingId), id: editingId, title, targetDate: editDate };
    setItems((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
    cancelEdit();
    try {
      await saveCountdown(updated);
    } catch (err) {
      console.error('Failed to update countdown:', err);
      void reload();
    }
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((c) => c.id !== id));
    try {
      await deleteCountdown(id);
    } catch (err) {
      console.error('Failed to delete countdown:', err);
      void reload();
    }
  };

  const renderProgress = (item: CountdownItem) => {
    const progress = countdownProgress(item.targetDate, now);
    const isPassed = progress.kind === 'passed';
    const value = progress.kind === 'today'
      ? t('countdown.today')
      : t(isPassed ? 'countdown.passed' : 'countdown.remaining', { days: progress.days });
    return (
      <div className={`text-2xl font-mono tabular-nums font-medium ${isPassed ? 'text-gh-subtle' : 'text-gh-fg'}`}>
        {value}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 pb-24">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="pb-2">
            <h2 className="text-lg font-semibold text-gh-fg tracking-tight">{t('countdown.title')}</h2>
            <p className="text-gh-muted text-xs mt-1">{t('countdown.description')}</p>
          </div>

          {/* Add form */}
          <div className="bg-gh-surface rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="h-4 w-4 text-gh-muted" aria-hidden="true" />
              <h3 className="text-gh-fg font-medium text-sm">{t('countdown.addTitle')}</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t('countdown.titlePlaceholder')}
                maxLength={200}
                className="flex-1"
              />
              <Input
                type="datetime-local"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="sm:w-64"
                aria-label={t('countdown.dateLabel')}
              />
              <Button onClick={() => void handleAdd()} disabled={!newTitle.trim() || !newDate}>
                <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                {t('countdown.add')}
              </Button>
            </div>
            {error && (
              <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          {/* Cards grid, same rounded card language as the stats view */}
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-gh-muted text-sm">{t('common.loading')}</div>
          ) : sortedItems.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gh-muted text-sm rounded-2xl bg-gh-surface">
              {t('countdown.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedItems.map((item) => {
                const isEditing = editingId === item.id;
                return (
                  <div key={item.id} className="bg-gh-surface rounded-2xl p-5 flex flex-col gap-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-gh-fg font-medium text-sm truncate" title={item.title}>
                        {isEditing ? '' : item.title}
                      </div>
                      {!isEditing && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEdit(item)}
                            aria-label={t('common.edit')}
                            title={t('common.edit')}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => void handleDelete(item.id)}
                            aria-label={t('common.delete')}
                            title={t('common.delete')}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <Input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder={t('countdown.titlePlaceholder')}
                          maxLength={200}
                        />
                        <Input
                          type="datetime-local"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          aria-label={t('countdown.dateLabel')}
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => void confirmEdit()}>
                            <Check className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                            {t('common.save')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            {t('common.cancel')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {renderProgress(item)}
                        <div className="text-xs text-gh-muted font-mono">
                          {formatTargetDate(item.targetDate, locale)}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CountdownPage;
