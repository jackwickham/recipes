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

// Metric abbreviations written adjacent to the number (no space)
const ADJACENT_UNITS = new Set(["g", "kg", "mg", "ml", "cl", "L", "l"]);

// Format quantity with unit, adding space where appropriate
// e.g., "500g", "1kg" vs "1 bunch", "2 tsp"
export function formatQuantityWithUnit(
  quantity: number | null,
  unit: string | null
): string {
  if (quantity === null) return "";
  const qty = quantity.toString().replace(/\.0$/, "");
  if (!unit) return qty;
  const space = ADJACENT_UNITS.has(unit) ? "" : " ";
  return `${qty}${space}${unit}`;
}