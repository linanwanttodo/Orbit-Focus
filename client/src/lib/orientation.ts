import { useCallback, useEffect, useState } from 'react';

export type ClockRotation = 0 | 90 | -90;

export function getClockRotation(gamma: number | null, _beta: number | null): ClockRotation {
  if (gamma === null || !Number.isFinite(gamma)) return 0;
  if (gamma >= 45) return 90;
  if (gamma <= -45) return -90;
  return 0;
}

export function shouldUseDeviceOrientation(viewportWidth: number, touchPoints: number): boolean {
  return viewportWidth <= 1024 && touchPoints > 0;
}

type OrientationPermissionApi = {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

type ScreenOrientationLockApi = {
  lock?: (orientation: 'landscape') => Promise<void>;
};

export interface ClockOrientationController {
  rotation: ClockRotation;
  systemLandscapeLocked: boolean;
  enableSystemLandscape: () => Promise<boolean>;
  releaseSystemLandscape: () => void;
}

export function useClockOrientation(): ClockOrientationController {
  const [rotation, setRotation] = useState<ClockRotation>(0);
  const [systemLandscapeLocked, setSystemLandscapeLocked] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!shouldUseDeviceOrientation(window.innerWidth, navigator.maxTouchPoints || 0)) return;
      if (window.innerWidth > window.innerHeight) {
        setRotation(0);
        return;
      }
      setRotation(getClockRotation(event.gamma, event.beta));
    };
    const handleScreenChange = () => {
      if (window.innerWidth > window.innerHeight) setRotation(0);
    };

    window.addEventListener('deviceorientation', handleOrientation);
    screen.orientation?.addEventListener('change', handleScreenChange);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      screen.orientation?.removeEventListener('change', handleScreenChange);
    };
  }, []);

  const enableSystemLandscape = useCallback(async () => {
    if (typeof window === 'undefined' || !shouldUseDeviceOrientation(window.innerWidth, navigator.maxTouchPoints || 0)) {
      return false;
    }

    try {
      const permissionApi = window.DeviceOrientationEvent as unknown as OrientationPermissionApi;
      if (typeof permissionApi.requestPermission === 'function') {
        const permission = await permissionApi.requestPermission();
        if (permission !== 'granted') return false;
      }
      const orientationApi = screen.orientation as ScreenOrientation & ScreenOrientationLockApi;
      if (typeof orientationApi.lock !== 'function') return false;
      await orientationApi.lock('landscape');
      setSystemLandscapeLocked(true);
      setRotation(0);
      return true;
    } catch {
      return false;
    }
  }, []);

  const releaseSystemLandscape = useCallback(() => {
    if (typeof screen !== 'undefined' && typeof screen.orientation?.unlock === 'function') {
      try {
        screen.orientation.unlock();
      } catch {
        // The browser can decline unlock; CSS rotation remains available.
      }
    }
    setSystemLandscapeLocked(false);
    setRotation(0);
  }, []);

  return { rotation, systemLandscapeLocked, enableSystemLandscape, releaseSystemLandscape };
}
