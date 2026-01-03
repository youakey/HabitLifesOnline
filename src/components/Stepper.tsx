import { Minus, Plus } from "lucide-react";

export default function Stepper({
  value,
  step,
  min = 0,
  onChange
}: {
  value: number;
  step: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  const v = Number.isFinite(value) ? value : 0;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn btn-ghost h-9 w-9 p-0 rounded-2xl"
        onClick={() => onChange(Math.max(min, Math.round((v - step) * 100) / 100))}
        aria-label="Decrease"
      >
        <Minus className="h-4 w-4" />
      </button>

      <input
        className="input w-24 text-right"
        type="number"
        step={step}
        min={min}
        value={v}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      <button
        type="button"
        className="btn btn-ghost h-9 w-9 p-0 rounded-2xl"
        onClick={() => onChange(Math.round((v + step) * 100) / 100)}
        aria-label="Increase"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
