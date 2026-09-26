import { useCallback, useEffect, useRef, useState } from 'react';
import { Task } from '../types';
import {
  pauseTimer,
  startTimer,
  tickTimer,
  type TimerSnapshot,
} from '../lib/timer';
import { addFocusSession } from '../services/store';

export interface CountdownState {
  countdownTime: number;
  countdownInput: number;
  countdownInputHours: number;
  countdownActive: boolean;
  countdownTimeLeft: number;
  countdownStartTime: string | null;
  countdownDeadline: number | null;
}

export type ClockStyle = 'digital' | 'flip';

export interface AppTimerState {
  countdown: CountdownState;
  isFullscreen: boolean;
  currentView: 'home' | 'focus' | 'stats' | 'settings';
  activeTimerTab: 'clock' | 'countdown' | 'future' | 'todo';
  tasks: Task[];
  timeStyle: ClockStyle;
  countdownStyle: ClockStyle;
}

export interface TimerActions {
  setCountdownTime: (seconds: number) => void;
  setCountdownInput: (minutes: number) => void;
  setCountdownInputHours: (hours: number) => void;
  toggleCountdown: () => void;
  resetCountdown: () => void;
  setCurrentView: (view: 'home' | 'focus' | 'stats' | 'settings') => void;
  setActiveTimerTab: (tab: 'clock' | 'countdown' | 'future' | 'todo') => void;
  setTasks: (tasks: Task[]) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
  setTimeStyle: (style: ClockStyle) => void;
  setCountdownStyle: (style: ClockStyle) => void;
}

const TIMER_STORAGE_KEY = 'orbit-focus-v2-countdown';
const DEFAULT_DURATION = 1800;

interface PersistedCountdown {
  countdownTime: number;
  countdownInput: number;
  countdownInputHours: number;
  countdownActive: boolean;
  countdownTimeLeft: number;
  countdownStartTime: string | null;
  countdownDeadline: number | null;
}

function defaultCountdown(): CountdownState {
  return {
    countdownTime: DEFAULT_DURATION,
    countdownInput: 30,
    countdownInputHours: 0,
    countdownActive: false,
    countdownTimeLeft: DEFAULT_DURATION,
    countdownStartTime: null,
    countdownDeadline: null,
  };
}

function finiteInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
}

function readPersistedCountdown(): CountdownState {
  const fallback = defaultCountdown();
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<PersistedCountdown>;
    const countdownTime = finiteInteger(saved.countdownTime, DEFAULT_DURATION, 1, 24 * 3600);
    const countdownTimeLeft = finiteInteger(saved.countdownTimeLeft, countdownTime, 0, countdownTime);
    const countdownDeadline = saved.countdownActive && typeof saved.countdownDeadline === 'number'
      ? saved.countdownDeadline
      : null;
    return {
      countdownTime,
      countdownInput: finiteInteger(saved.countdownInput, Math.floor(countdownTime / 60), 0, 59),
      countdownInputHours: finiteInteger(saved.countdownInputHours, Math.floor(countdownTime / 3600), 0, 23),
      countdownActive: Boolean(saved.countdownActive && countdownDeadline !== null),
      countdownTimeLeft,
      countdownStartTime: typeof saved.countdownStartTime === 'string' ? saved.countdownStartTime : null,
      countdownDeadline,
    };
  } catch {
    return fallback;
  }
}

function snapshotFromState(state: CountdownState): TimerSnapshot {
  return {
    duration: state.countdownTime,
    remaining: state.countdownTimeLeft,
    active: state.countdownActive,
    deadline: state.countdownDeadline,
    startTime: state.countdownStartTime,
  };
}

function applySnapshot(state: CountdownState, snapshot: TimerSnapshot): CountdownState {
  return {
    ...state,
    countdownActive: snapshot.active,
    countdownTimeLeft: snapshot.remaining,
    countdownStartTime: snapshot.startTime,
    countdownDeadline: snapshot.deadline,
  };
}

export function useTimerState(): [AppTimerState, TimerActions] {
  const [countdown, setCountdown] = useState<CountdownState>(readPersistedCountdown);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'focus' | 'stats' | 'settings'>('home');
  const [activeTimerTab, setActiveTimerTab] = useState<'clock' | 'countdown' | 'future' | 'todo'>('clock');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeStyle, setTimeStyle] = useState<ClockStyle>('digital');
  const [countdownStyle, setCountdownStyle] = useState<ClockStyle>('digital');

  const audioContextRef = useRef<AudioContext | null>(null);
  const completionRecordedRef = useRef(false);
  const countdownRef = useRef(countdown);

  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  const ensureAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = window.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextConstructor();
    if (audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playNotification = useCallback(() => {
    try {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (error) {
      console.warn('Unable to play timer notification:', error);
    }
  }, [ensureAudioContext]);

  useEffect(() => {
    try {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(countdown));
    } catch {
      // Timer still works when storage is unavailable.
    }
  }, [countdown]);

  const setCountdownTime = useCallback((seconds: number) => {
    const safeSeconds = finiteInteger(seconds, DEFAULT_DURATION, 1, 24 * 3600);
    setCountdown((previous) => ({
      ...previous,
      countdownTime: safeSeconds,
      countdownTimeLeft: safeSeconds,
      countdownStartTime: null,
      countdownDeadline: null,
    }));
  }, []);

  const setCountdownInput = useCallback((minutes: number) => {
    setCountdown((previous) => ({ ...previous, countdownInput: finiteInteger(minutes, 0, 0, 59) }));
  }, []);

  const setCountdownInputHours = useCallback((hours: number) => {
    setCountdown((previous) => ({ ...previous, countdownInputHours: finiteInteger(hours, 0, 0, 23) }));
  }, []);

  const toggleCountdown = useCallback(() => {
    setCountdown((previous) => {
      const snapshot = snapshotFromState(previous);
      if (!snapshot.active) {
        completionRecordedRef.current = false;
        return applySnapshot(previous, startTimer(snapshot));
      }
      return applySnapshot(previous, pauseTimer(snapshot));
    });
    ensureAudioContext();
  }, [ensureAudioContext]);

  const resetCountdown = useCallback(() => {
    completionRecordedRef.current = false;
    setCountdown((previous) => ({
      ...previous,
      countdownActive: false,
      countdownTimeLeft: previous.countdownTime,
      countdownStartTime: null,
      countdownDeadline: null,
    }));
  }, []);

  useEffect(() => {
    if (!countdown.countdownActive || countdown.countdownDeadline === null) return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const now = Date.now();
      const snapshot = snapshotFromState(countdownRef.current);
      const next = tickTimer(snapshot, now);
      if (next.remaining !== snapshot.remaining) {
        setCountdown((previous) => ({ ...previous, countdownTimeLeft: next.remaining }));
      }
      if (snapshot.active && !next.active && !completionRecordedRef.current) {
        completionRecordedRef.current = true;
        const startedAt = snapshot.startTime;
        if (snapshot.duration > 0 && startedAt) {
          void addFocusSession(snapshot.duration, startedAt, new Date(now)).catch((error) =>
            console.error('Failed to save completed countdown session:', error)
          );
        }
        setCountdown((previous) => ({
          ...previous,
          countdownActive: false,
          countdownTimeLeft: 0,
          countdownStartTime: null,
          countdownDeadline: null,
        }));
        playNotification();
      }
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [countdown.countdownActive, countdown.countdownDeadline, countdown.countdownStartTime, countdown.countdownTime, playNotification]);

  const state: AppTimerState = {
    countdown,
    isFullscreen,
    currentView,
    activeTimerTab,
    tasks,
    timeStyle,
    countdownStyle,
  };

  const actions: TimerActions = {
    setCountdownTime,
    setCountdownInput,
    setCountdownInputHours,
    toggleCountdown,
    resetCountdown,
    setCurrentView,
    setActiveTimerTab,
    setTasks,
    setIsFullscreen,
    setTimeStyle,
    setCountdownStyle,
  };

  return [state, actions];
}
