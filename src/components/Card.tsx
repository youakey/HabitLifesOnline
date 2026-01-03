import { motion } from "framer-motion";
import { cn } from "../lib/ui";
import { loadPrefs } from "../lib/prefs";

type Tone = "elevated" | "subtle";

export default function Card({
  title,
  subtitle,
  right,
  children,
  className,
  tone = "elevated",
  hover = true
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tone?: Tone;
  hover?: boolean;
}) {
  const prefs = loadPrefs();
  const Wrapper: any = prefs.animations ? motion.section : "section";

  return (
    <Wrapper
      {...(prefs.animations
        ? {
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.22, ease: "easeOut" }
          }
        : {})}
      className={cn(
        "card",
        tone === "subtle" ? "glass-subtle" : "glass",
        "rounded-[22px] p-4 md:p-5",
        hover ? "hover:translate-y-[-1px] hover:shadow-[0_18px_60px_rgba(0,0,0,0.45)] transition" : "",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[22px] border border-white/10" />
      <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-indigo-500/18 blur-3xl" />

      <header className="relative flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="h1 truncate-1">{title}</div>
          {subtitle ? <div className="text-xs text-slate-400 mt-1">{subtitle}</div> : null}
        </div>
        <div className="shrink-0 flex items-center gap-2">{right}</div>
      </header>

      <div className="relative">{children}</div>
    </Wrapper>
  );
}
