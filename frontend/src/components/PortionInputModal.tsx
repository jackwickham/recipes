import { useState, useEffect, useRef } from "preact/hooks";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (portions: number) => void;
  initialValue?: number;
}

export function PortionInputModal({
  isOpen,
  onClose,
  onSubmit,
  initialValue = 4,
}: Props) {
  const [value, setValue] = useState(initialValue.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue.toString());
      // Focus the input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  function handleSubmit(e: Event) {
    e.preventDefault();
    const portions = parseInt(value, 10);
    if (isNaN(portions) || portions <= 0) {
      alert("Please enter a valid number of portions");
      return;
    }
    onSubmit(portions);
  }

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div
        class="modal-content"
        style="max-width: 400px;"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="modal-header">
          <h2>Change Portions</h2>
          <button class="btn btn-small" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div class="modal-body">
            <p style="margin-bottom: 1rem; color: var(--color-text-secondary);">
              How many portions would you like the AI to scale this recipe to?
            </p>
            <div class="form-group">
              <label for="portion-input">Number of portions</label>
              <input
                id="portion-input"
                ref={inputRef}
                type="number"
                min="1"
                step="1"
                value={value}
                onInput={(e) => setValue(e.currentTarget.value)}
                required
              />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              Scale Recipe
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
