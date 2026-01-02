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
    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2LkZeWj4F0aGRqc4GQnKShmI2BesLCwr68uLKsq62xs7q/wMG7r56LdGNbXW17jJ2osLCom4uAbW1xeYqZpqylmYmBd3l9gpKfqqqjlYR4cXF2g5Sfp6ehlImAeXt/iJWeoqCYjoR+fH+GkZqfnpiQhoF+gISNlpudmZOLhIGBhIqSmJuZlI6Ig4OEiI6Ul5aUj4qGhIWHi5CUlpSSjoqHhoaIjJCTlJKPi4iGhoiKjpGSkpCNioiHh4mLj5GRkI6LiYiIiYuOkJCPjYuJiIiJi42Pj46Mi4mIiImLjY6OjYyKiYmJiouNjo6NjIqJiYmKi42NjYyLioqJiouMjY2MjIuKioqKi4yMjIyLioqKiouLjIyMi4uKioqLi4uMjIuLi4qKi4uLi4yMi4uLioqLi4uLjIyLi4uKi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4s="
    );
    return () => {
      // Clean up intervals on unmount
      intervalsRef.current.forEach((intervalId) => clearInterval(intervalId));
    };
  }, []);

  const startTimer = useCallback((id: string, minutes: number) => {
    const totalSeconds = minutes * 60;

    setTimers((prev) => {
      const next = new Map(prev);
      next.set(id, {
        id,
        totalSeconds,
        remainingSeconds: totalSeconds,
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
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
