import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { Button } from './ui/button';

interface DateTimePickerProps {
  /** Currently selected date; null falls back to "today" for the default view. */
  value: Date | null;
  onChange: (date: Date) => void;
}

// In-repo month calendar. Replaces the native datetime-local input, whose
// segment highlight looks like accidental text selection. Date-only: no
// time fields. Static surfaces only: no gradients, no hover states.
export const DateTimePicker: React.FC<DateTimePickerProps> = ({ value, onChange }) => {
  const { language } = useI18n();
  const locale = language === 'zh' ? 'zh-CN' : language === 'ru' ? 'ru-RU' : 'en-US';

  const [viewYear, setViewYear] = useState(() => (value ?? new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (value ?? new Date()).getMonth());

  // Re-sync the visible month whenever the dialog opens with a new value.
  useEffect(() => {
    const d = value ?? new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value]);

  const cells = useMemo<(number | null)[]>(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const result: (number | null)[] = Array.from({ length: firstWeekday }, () => null);
    for (let day = 1; day <= daysInMonth; day++) result.push(day);
    while (result.length % 7 !== 0) result.push(null);
    return result;
  }, [viewYear, viewMonth]);

  // Short weekday labels; 2023-01-01 was a Sunday so offset by weekday index.
  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, wd) =>
      new Date(2023, 0, 1 + wd).toLocaleDateString(locale, { weekday: 'narrow' })
    ),
    [locale]
  );

  // Localized month names for the month dropdown.
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, m) =>
      new Date(2023, m, 1).toLocaleDateString(locale, { month: 'long' })
    ),
    [locale]
  );

  // Jump-select years: a few years back and ~15 ahead covers countdown use.
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 21 }, (_, i) => currentYear - 5 + i),
    [currentYear]
  );

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const isSelectedDay = (day: number): boolean =>
    !!value &&
    value.getFullYear() === viewYear &&
    value.getMonth() === viewMonth &&
    value.getDate() === day;

  const selectDay = (day: number) => {
    // Midnight local time: countdowns are day-granularity.
    onChange(new Date(viewYear, viewMonth, day, 0, 0, 0, 0));
  };

  return (
    <div className="rounded-xl border border-gh-border bg-gh-surface p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          title="Previous month"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="flex items-center gap-2">
          <select
            aria-label="Year"
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="h-8 rounded-lg border-0 bg-gh-inset px-2 text-sm text-gh-fg font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            aria-label="Month"
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="h-8 rounded-lg border-0 bg-gh-inset px-2 text-sm text-gh-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {monthOptions.map((name, m) => (
              <option key={m} value={m}>{name}</option>
            ))}
          </select>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          title="Next month"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekdayLabels.map((label, wd) => (
          <div key={wd} className="text-center text-[10px] text-gh-muted py-1 font-medium">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) =>
          day === null ? (
            <div key={index} aria-hidden="true" />
          ) : (
            <button
              key={index}
              type="button"
              onClick={() => selectDay(day)}
              aria-pressed={isSelectedDay(day)}
              aria-label={new Date(viewYear, viewMonth, day).toLocaleDateString(locale)}
              className={`h-8 w-8 mx-auto rounded-lg text-xs font-mono tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSelectedDay(day) ? 'bg-primary text-primary-foreground' : 'text-gh-fg'
              }`}
            >
              {day}
            </button>
          )
        )}
      </div>
    </div>
  );
};
