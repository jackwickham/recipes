import { formatDuration } from "../hooks/useTimer";

// Parse {{timer:MINUTES}} markers and return array of timer info
export interface TimerInfo {
  minutes: number;
  position: number;
}

export function extractTimers(text: string): TimerInfo[] {
  const timers: TimerInfo[] = [];
  const regex = /\{\{timer:(\d*\.?\d+)\}\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    timers.push({
      minutes: parseFloat(match[1]),
      position: match.index,
    });
  }

  return timers;
}

// Render timer markers as readable text
export function renderTimerMarkers(text: string): string {
  return text.replace(/\{\{timer:(\d*\.?\d+)\}\}/g, (_, minutes) => {
    const mins = parseFloat(minutes);
    return formatDuration(Math.round(mins * 60));
  });
}

// Render all markers in step text
export function renderStepText(text: string): string {
  return renderTimerMarkers(text);
}