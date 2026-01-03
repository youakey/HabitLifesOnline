import { motion } from "framer-motion";
import { cn } from "../lib/ui";

export default function Switch({
  checked,
  onChange
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 rounded-full border transition outline-none overflow-hidden",
        checked ? "bg-indigo-500/70 border-indigo-300/30" : "bg-white/10 border-white/10"
      )}
      aria-pressed={checked}
    >
      {/* subtle flash */}
      {checked ? (
        <motion.span
          initial={{ opacity: 0.0 }}
          animate={{ opacity: 0.35 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-white/20"
        />
      ) : null}

      <motion.span
        layout
        transition={{ type: "spring", stiffness: 520, damping: 30 }}
        className={cn(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white/90 shadow",
          checked ? "left-6" : "left-0.5"
        )}
      />
    </button>
  );
}
