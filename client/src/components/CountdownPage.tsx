import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { CountdownItem } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { deleteCountdown, listCountdowns, saveCountdown } from '../services/store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { DateTimePicker } from './DateTimePicker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

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
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const CountdownPage: React.FC = () => {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const now = useMinuteTick();

  const [items, setItems] = useState<CountdownItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // One dialog handles both create (editingItem = null) and edit.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CountdownItem | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState<Date | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const locale = language === 'zh' ? 'zh-CN' : language === 'ru' ? 'ru-RU' : 'en-US';

  // Store target dates as local "YYYY-MM-DDT00:00" (midnight). Keeping the
  // time suffix ensures new Date() parses it as local, not UTC, so the
  // calendar day never shifts across time zones.
  const toLocalDateValue = (date: Date): string =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T00:00`;

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

  const openCreate = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormDate(new Date());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (item: CountdownItem) => {
    const parsed = new Date(item.targetDate);
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDate(Number.isNaN(parsed.getTime()) ? null : parsed);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setFormError(null);
  };

  const handleSubmit = async () => {
    const title = formTitle.trim();
    if (!title || !formDate) {
      setFormError(t('countdown.invalidInput'));
      return;
    }
    const targetDate = toLocalDateValue(formDate);
    setIsSubmitting(true);
    try {
      if (editingItem) {
        const updated: CountdownItem = { ...editingItem, title, targetDate };
        setItems((prev) => prev.map((c) => (c.id === editingItem.id ? updated : c)));
        setDialogOpen(false);
        try {
          await saveCountdown(updated);
        } catch (err) {
          console.error('Failed to update countdown:', err);
          void reload();
        }
      } else {
        const item: CountdownItem = {
          id: `cd_${crypto.randomUUID()}`,
          title,
          targetDate,
        };
        setItems((prev) => [...prev, item]);
        setDialogOpen(false);
        try {
          await saveCountdown(item);
        } catch (err) {
          console.error('Failed to save countdown:', err);
          setError(err instanceof Error ? err.message : t('countdown.loadFailed'));
          void reload();
        }
      }
    } finally {
      setIsSubmitting(false);
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
          <div className="flex items-start justify-between gap-4 pb-2">
            <div>
              <h2 className="text-lg font-semibold text-gh-fg tracking-tight">{t('countdown.title')}</h2>
              <p className="text-gh-muted text-xs mt-1">{t('countdown.description')}</p>
            </div>
            <Button
              size="icon"
              onClick={openCreate}
              aria-label={t('countdown.add')}
              title={t('countdown.add')}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Cards grid, same rounded card language as the stats view */}
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-gh-muted text-sm">{t('common.loading')}</div>
          ) : sortedItems.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gh-muted text-sm rounded-2xl bg-gh-surface">
              {t('countdown.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedItems.map((item) => (
                <div key={item.id} className="bg-gh-surface rounded-2xl p-5 flex flex-col gap-3 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-gh-fg font-medium text-sm truncate" title={item.title}>
                      {item.title}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(item)}
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
                  </div>

                  {renderProgress(item)}
                  <div className="text-xs text-gh-muted font-mono">
                    {formatTargetDate(item.targetDate, locale)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create / edit dialog: the only place to fill in countdown fields */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent aria-describedby={undefined} className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? t('countdown.editTitle') : t('countdown.addNew')}</DialogTitle>
            <DialogDescription>{t('countdown.description')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="countdown-title" className="text-xs font-medium text-gh-muted">
                {t('countdown.title')}
              </label>
              <Input
                id="countdown-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t('countdown.titlePlaceholder')}
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span id="countdown-date-label" className="text-xs font-medium text-gh-muted">
                {t('countdown.dateLabel')}
              </span>
              <div aria-labelledby="countdown-date-label">
                <DateTimePicker value={formDate} onChange={setFormDate} />
              </div>
            </div>
            {formError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {editingItem ? t('common.save') : t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CountdownPage;
