import { motion } from "framer-motion";
import { loadPrefs } from "../lib/prefs";

export default function Page({ children }: { children: React.ReactNode }) {
  const prefs = loadPrefs();
  if (!prefs.animations) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
