interface Props {
  baseServings: number;
  currentServings: number;
  onServingsChange: (servings: number) => void;
}

export function ScalingControls({
  baseServings,
  currentServings,
  onServingsChange,
}: Props) {
  const scale = currentServings / baseServings;

  return (
    <div class="scaling-controls">
      <span class="scaling-label">Servings:</span>
      <button
        class="scaling-btn"
        onClick={() => onServingsChange(Math.max(1, currentServings - 1))}
        disabled={currentServings <= 1}
      >
        −
      </button>
      <span class="scaling-value">{currentServings}</span>
      <button
        class="scaling-btn"
        onClick={() => onServingsChange(currentServings + 1)}
      >
        +
      </button>
      {scale !== 1 && (
        <span class="scaling-indicator">
          ({scale > 1 ? `${scale.toFixed(1)}×` : `${scale.toFixed(1)}×`})
        </span>
      )}
    </div>
  );
}
