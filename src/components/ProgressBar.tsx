import { cn } from "../lib/ui";

export default function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("h-2 w-full rounded-full bg-white/6 border border-white/10 overflow-hidden", className)}>
      <div className="h-full bg-indigo-400/70" style={{ width: `${v * 100}%` }} />
    </div>
  );
}
