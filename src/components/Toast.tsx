import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CloudOff, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: string; kind: ToastKind; title: string; detail?: string };

const Ctx = createContext<{ push: (t: Omit<ToastItem,"id">) => void } | null>(null);

function icon(kind: ToastKind) {
  if (kind === "success") return <CheckCircle2 className="h-4 w-4 text-emerald-200" />;
  if (kind === "error") return <CloudOff className="h-4 w-4 text-red-200" />;
  return <Info className="h-4 w-4 text-slate-200" />;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = crypto.randomUUID();
    const item: ToastItem = { id, ...t };
    setItems((p) => [item, ...p].slice(0, 4));
    window.setTimeout(() => {
      setItems((p) => p.filter((x) => x.id !== id));
    }, 1800);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 space-y-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="glass-2 rounded-2xl px-3 py-2 w-[320px]"
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">{icon(t.kind)}</div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{t.title}</div>
                  {t.detail ? <div className="text-xs text-slate-300 mt-0.5">{t.detail}</div> : null}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
