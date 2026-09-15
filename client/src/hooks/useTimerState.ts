import { useState, useCallback, useEffect, useRef } from 'react';
import { Task } from '../types';
import { addFocusSession } from '../services/store';

export interface CountdownState {
  countdownTime: number;
  countdownInput: number;
  countdownInputHours: number;
  countdownActive: boolean;
  countdownTimeLeft: number;
  countdownStartTime: Date | null;
}

export type ClockStyle = 'digital' | 'flip';

export interface AppTimerState {
  countdown: CountdownState;
  zenMode: boolean;
  isFullscreen: boolean;
  currentView: 'home' | 'timer' | 'countdown' | 'stats' | 'settings';
  activeTimerTab: 'pomodoro' | 'countdown' | 'todo';
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
  toggleZenMode: () => void;
  setCurrentView: (view: 'home' | 'timer' | 'countdown' | 'stats' | 'settings') => void;
  setActiveTimerTab: (tab: 'pomodoro' | 'countdown' | 'todo') => void;
  setTasks: (tasks: Task[]) => void;
  setIsFullscreen: (fullscreen: boolean) => void;
  setTimeStyle: (style: ClockStyle) => void;
  setCountdownStyle: (style: ClockStyle) => void;
}

const getInitialCountdownState = (): CountdownState => ({
  countdownTime: 1800,
  countdownInput: 30,
  countdownInputHours: 0,
  countdownActive: false,
  countdownTimeLeft: 1800,
  countdownStartTime: null,
});

export function useTimerState(): [AppTimerState, TimerActions] {
  const [countdown, setCountdown] = useState<CountdownState>(getInitialCountdownState);
  const [zenMode, setZenMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'timer' | 'countdown' | 'stats' | 'settings'>('home');
  const [activeTimerTab, setActiveTimerTab] = useState<'pomodoro' | 'countdown' | 'todo'>('pomodoro');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeStyle, setTimeStyle] = useState<ClockStyle>('digital');
  const [countdownStyle, setCountdownStyle] = useState<ClockStyle>('digital');

  const audioContextRef = useRef<AudioContext | null>(null);

  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playNotification = useCallback(() => {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }, [ensureAudioContext]);

  const setCountdownTime = useCallback((seconds: number) => {
    setCountdown((prev) => ({
      ...prev,
      countdownTime: seconds,
      countdownTimeLeft: seconds,
    }));
  }, []);

  const setCountdownInput = useCallback((minutes: number) => {
    setCountdown((prev) => ({
      ...prev,
      countdownInput: minutes,
    }));
  }, []);

  const setCountdownInputHours = useCallback((hours: number) => {
    setCountdown((prev) => ({
      ...prev,
      countdownInputHours: hours,
    }));
  }, []);

  const toggleCountdown = useCallback(() => {
    setCountdown((prev) => {
      if (!prev.countdownActive) {
        return {
          ...prev,
          countdownActive: true,
          countdownStartTime: new Date(),
          countdownTimeLeft: prev.countdownTime,
        };
      }

      const duration = prev.countdownTime;
      const startedAt = prev.countdownStartTime?.toISOString() ?? new Date().toISOString();
      if (duration > 0 && prev.countdownStartTime) {
        void addFocusSession(duration, startedAt).catch((err) =>
          console.error('Failed to save countdown session:', err)
        );
      }

      return {
        ...prev,
        countdownActive: false,
        countdownStartTime: null,
      };
    });
    ensureAudioContext();
  }, [ensureAudioContext]);

  const resetCountdown = useCallback(() => {
    setCountdown((prev) => ({
      ...prev,
      countdownActive: false,
      countdownTimeLeft: prev.countdownTime,
      countdownStartTime: null,
    }));
  }, []);

  const toggleZenMode = useCallback(() => {
    setZenMode((prev) => !prev);
  }, []);

  // Countdown Timer Effect
  useEffect(() => {
    let interval: number | null = null;
    if (countdown.countdownActive && countdown.countdownTimeLeft > 0) {
      interval = window.setInterval(() => {
        setCountdown((prev) => ({ ...prev, countdownTimeLeft: prev.countdownTimeLeft - 1 }));
      }, 1000);
    } else if (countdown.countdownTimeLeft === 0 && countdown.countdownActive) {
      setCountdown((prev) => ({ ...prev, countdownActive: false }));
      playNotification();

      const duration = countdown.countdownTime;
      const startedAt = countdown.countdownStartTime?.toISOString() ?? new Date().toISOString();
      if (duration > 0 && countdown.countdownStartTime) {
        void addFocusSession(duration, startedAt).catch((err) =>
          console.error('Failed to save countdown session:', err)
        );
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [countdown.countdownActive, countdown.countdownTimeLeft, countdown.countdownTime, countdown.countdownStartTime, playNotification]);

  const state: AppTimerState = {
    countdown,
    zenMode,
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
    toggleZenMode,
    setCurrentView,
    setActiveTimerTab,
    setTasks,
    setIsFullscreen,
    setTimeStyle,
    setCountdownStyle,
  };

  return [state, actions];
}
