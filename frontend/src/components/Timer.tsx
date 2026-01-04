import type { Timer as TimerType } from "../hooks/useTimer";
import { formatTime, formatDuration } from "../hooks/useTimer";

interface Props {
  timer: TimerType | undefined;
  minutes: number;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}

export function Timer({ timer, minutes, onStart, onStop, onReset }: Props) {
  if (!timer) {
    const duration = formatDuration(Math.round(minutes * 60));
    return (
      <button class="timer-start-btn" onClick={onStart}>
        Start {duration} timer
      </button>
    );
  }

  const progress = timer.remainingSeconds / timer.totalSeconds;

  return (
    <div class={`timer-display ${timer.isComplete ? "timer-complete" : ""}`}>
      <div class="timer-progress" style={{ width: `${progress * 100}%` }} />
      <span class="timer-time">{formatTime(timer.remainingSeconds)}</span>
      {timer.isComplete ? (
        <button class="timer-btn" onClick={onReset}>
          Done
        </button>
      ) : timer.isRunning ? (
        <button class="timer-btn" onClick={onStop}>
          Pause
        </button>
      ) : (
        <>
          <button class="timer-btn" onClick={onStart}>
            Resume
          </button>
          <button class="timer-btn" onClick={onReset}>
            Reset
          </button>
        </>
      )}
    </div>
  );
}
