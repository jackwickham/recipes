import { useState, useCallback, useEffect } from "preact/hooks";

export function useWakeLock() {
  const [isSupported, setIsSupported] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    setIsSupported("wakeLock" in navigator);
  }, []);

  const request = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const lock = await navigator.wakeLock.request("screen");
      setWakeLock(lock);
      setIsActive(true);

      // Re-acquire wake lock if page becomes visible again
      lock.addEventListener("release", () => {
        setIsActive(false);
        setWakeLock(null);
      });

      return true;
    } catch (err) {
      console.error("Failed to acquire wake lock:", err);
      return false;
    }
  }, [isSupported]);

  const release = useCallback(async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
      setIsActive(false);
    }
  }, [wakeLock]);

  const toggle = useCallback(async () => {
    if (isActive) {
      await release();
    } else {
      await request();
    }
  }, [isActive, request, release]);

  // Re-acquire wake lock when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && isActive && !wakeLock) {
        await request();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isActive, wakeLock, request]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wakeLock) {
        wakeLock.release();
      }
    };
  }, [wakeLock]);

  return {
    isSupported,
    isActive,
    request,
    release,
    toggle,
  };
}
