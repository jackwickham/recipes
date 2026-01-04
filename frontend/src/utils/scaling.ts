import { formatDuration } from "../hooks/useTimer";

// Scale a quantity by a multiplier
export function scaleQuantity(value: number, scale: number): number {
  return value * scale;
}

// Format a quantity with smart unit conversion
export function formatQuantity(
  value: number,
  unit: string | null,
  scale: number = 1
): string {
  const scaled = scaleQuantity(value, scale);

  // Smart unit conversion for large values
  if (unit === "g" && scaled >= 1000) {
    return `${(scaled / 1000).toFixed(scaled % 1000 === 0 ? 0 : 1)}kg`;
  }
  if (unit === "ml" && scaled >= 1000) {
    return `${(scaled / 1000).toFixed(scaled % 1000 === 0 ? 0 : 1)}L`;
  }

  // Format the number nicely
  const formatted = Number.isInteger(scaled)
    ? scaled.toString()
    : scaled.toFixed(1).replace(/\.0$/, "");

  return unit ? `${formatted}${unit}` : formatted;
}

// Parse {{qty:VALUE:UNIT}} markers and replace with scaled values
export function renderQuantityMarkers(text: string, scale: number): string {
  return text.replace(/\{\{qty:([^:}]+):([^}]*)\}\}/g, (_, value, unit) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    return formatQuantity(numValue, unit || null, scale);
  });
}

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
export function renderStepText(text: string, scale: number): string {
  let result = renderQuantityMarkers(text, scale);
  result = renderTimerMarkers(result);
  return result;
}
