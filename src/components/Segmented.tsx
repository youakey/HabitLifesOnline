import { motion } from "framer-motion";
import { cn } from "../lib/ui";

export default function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn("seg-btn", active ? "seg-btn-active" : "seg-btn-inactive")}
          >
            {active ? (
              <motion.span
                layoutId="seg-pill"
                className="absolute inset-0 rounded-xl bg-white/10 border border-white/10"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            ) : null}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
