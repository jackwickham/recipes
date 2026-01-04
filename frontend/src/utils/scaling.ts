// Format a quantity with smart unit conversion
export function formatQuantity(value: number, unit: string | null): string {
  // Smart unit conversion for large values
  if (unit === "g" && value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}kg`;
  }
  if (unit === "ml" && value >= 1000) {
    return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}L`;
  }

  // Format the number nicely
  const formatted = Number.isInteger(value)
    ? value.toString()
    : value.toFixed(1).replace(/\.0$/, "");

  return unit ? `${formatted}${unit}` : formatted;
}

// Parse {{qty:VALUE:UNIT}} markers and replace with formatted values
export function renderQuantityMarkers(text: string): string {
  return text.replace(/\{\{qty:([^:}]+):([^}]*)\}\}/g, (_, value, unit) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    return formatQuantity(numValue, unit || null);
  });
}

// Parse {{timer:MINUTES}} markers and return array of timer info
export interface TimerInfo {
  minutes: number;
  position: number;
}

export function extractTimers(text: string): TimerInfo[] {
  const timers: TimerInfo[] = [];
  const regex = /\{\{timer:(\d+)\}\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    timers.push({
      minutes: parseInt(match[1], 10),
      position: match.index,
    });
  }

  return timers;
}

// Render timer markers as readable text
export function renderTimerMarkers(text: string): string {
  return text.replace(/\{\{timer:(\d+)\}\}/g, (_, minutes) => {
    const mins = parseInt(minutes, 10);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return remainingMins > 0 ? `${hours}h ${remainingMins}min` : `${hours}h`;
    }
    return `${mins} min`;
  });
}

// Render all markers in step text
export function renderStepText(text: string): string {
  let result = renderQuantityMarkers(text);
  result = renderTimerMarkers(result);
  return result;
}
