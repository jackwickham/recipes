import { useState, useEffect, useCallback, useRef } from "preact/hooks";

export interface Timer {
  id: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isComplete: boolean;
}

export function useTimer() {
  const [timers, setTimers] = useState<Map<string, Timer>>(new Map());
  const intervalsRef = useRef<Map<string, number>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create audio element for alerts
  useEffect(() => {
    // Create a simple beep using Web Audio API
    audioRef.current = new Audio("/timer.mp3");
    return () => {
      // Clean up intervals on unmount
      intervalsRef.current.forEach((intervalId) => clearInterval(intervalId));
    };
  }, []);

  const startTimer = useCallback((id: string, minutes: number) => {
    const totalSeconds = Math.round(minutes * 60);

    setTimers((prev) => {
      const existing = prev.get(id);
      const next = new Map(prev);

      // If timer exists and isn't complete, keep its current remaining time
      const remainingSeconds =
        existing && !existing.isComplete
          ? existing.remainingSeconds
          : totalSeconds;

      next.set(id, {
        id,
        totalSeconds,
        remainingSeconds,
        isRunning: true,
        isComplete: false,
      });
      return next;
    });

    // Clear existing interval if any
    const existingInterval = intervalsRef.current.get(id);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Start countdown
    const intervalId = window.setInterval(() => {
      setTimers((prev) => {
        const timer = prev.get(id);
        if (!timer || !timer.isRunning) {
          clearInterval(intervalId);
          return prev;
        }

        const newRemaining = timer.remainingSeconds - 1;

        if (newRemaining <= 0) {
          clearInterval(intervalId);
          intervalsRef.current.delete(id);

          // Play alert sound
          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }

          const next = new Map(prev);
          next.set(id, {
            ...timer,
            remainingSeconds: 0,
            isRunning: false,
            isComplete: true,
          });
          return next;
        }

        const next = new Map(prev);
        next.set(id, { ...timer, remainingSeconds: newRemaining });
        return next;
      });
    }, 1000);

    intervalsRef.current.set(id, intervalId);
  }, []);

  const stopTimer = useCallback((id: string) => {
    const intervalId = intervalsRef.current.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      intervalsRef.current.delete(id);
    }

    setTimers((prev) => {
      const timer = prev.get(id);
      if (!timer) return prev;

      const next = new Map(prev);
      next.set(id, { ...timer, isRunning: false });
      return next;
    });
  }, []);

  const resetTimer = useCallback((id: string) => {
    const intervalId = intervalsRef.current.get(id);
    if (intervalId) {
      clearInterval(intervalId);
      intervalsRef.current.delete(id);
    }

    setTimers((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const getTimer = useCallback(
    (id: string): Timer | undefined => {
      return timers.get(id);
    },
    [timers]
  );

  return {
    timers,
    startTimer,
    stopTimer,
    resetTimer,
    getTimer,
  };
}

// Format seconds as MM:SS or HH:MM:SS
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

// Format seconds into a human-readable duration string
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m} min`);
  if (s > 0) parts.push(`${s} sec`);

  return parts.length > 0 ? parts.join(" ") : "0 sec";
}
