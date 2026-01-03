import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Settings, BarChart3, Sparkles, LayoutDashboard, User2, NotebookPen, Menu, X, Wifi, WifiOff } from "lucide-react";
import { cn } from "../lib/ui";
import { signOut } from "../lib/db";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { loadPrefs } from "../lib/prefs";

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <NavLink to={to} className="block">
      {({ isActive }) => (
        <div
          className={cn(
            "relative flex items-center gap-2 rounded-2xl px-3 py-2 text-sm border transition overflow-hidden",
            isActive ? "bg-white/20 border-white/20" : "bg-white/0 border-white/10 hover:bg-white/10"
          )}
        >
          {isActive ? (
            <motion.div
              layoutId="nav-active"
              className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/25 to-cyan-400/10"
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
            />
          ) : null}
          <Icon className="relative h-4 w-4 text-slate-200" />
          <span className="relative">{label}</span>
        </div>
      )}
    </NavLink>
  );
}

function SidebarContent({
  email,
  initials,
  onSignOut,
  online,
  prefs
}: {
  email: string;
  initials: string;
  onSignOut: () => void;
  online: boolean;
  prefs: ReturnType<typeof loadPrefs>;
}) {
  return (
    <div className="glass rounded-[22px] p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/10 grid place-items-center">
          <Sparkles className="h-5 w-5 text-indigo-200" />
        </div>
        <div className="leading-tight min-w-0">
          <div className="text-base font-semibold">HabitLife</div>
          <div className="text-xs text-slate-300 truncate">{email || "—"}</div>
        </div>
      </div>

      <div className="glass-subtle rounded-2xl p-3 flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500/40 to-cyan-400/20 border border-white/10 grid place-items-center font-semibold">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">Today</div>
          <div className="text-xs text-slate-400 truncate">Small steps, strong results.</div>
        </div>
        <span className={cn("chip ml-auto", online ? "chip-good" : "chip-bad")}>
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? "Online" : "Offline"}
        </span>
      </div>

      <div className="space-y-2">
        {prefs.showProfile ? <NavItem to="/profile" icon={User2} label="Profile" /> : null}
        <NavItem to="/habits" icon={LayoutDashboard} label="Habits" />
        {prefs.showAnalytics ? <NavItem to="/analytics" icon={BarChart3} label="Analytics" /> : null}
        {prefs.showReflection ? <NavItem to="/reflection" icon={NotebookPen} label="Daily reflection" /> : null}
        <NavItem to="/settings" icon={Settings} label="Settings" />
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <button onClick={onSignOut} className="btn w-full justify-center">
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
    });
  }, []);

  async function onSignOut() {
    await signOut();
    navigate("/auth");
  }

  const initials = useMemo(() => {
    if (!email) return "HL";
    const name = email.split("@")[0] ?? "hl";
    const a = (name[0] ?? "h").toUpperCase();
    const b = (name[1] ?? "l").toUpperCase();
    return a + b;
  }, [email]);

  const [prefs, setPrefs] = useState(loadPrefs());

  useEffect(() => {
    const onPrefs = () => setPrefs(loadPrefs());
    window.addEventListener("habitlife:prefs", onPrefs);
    window.addEventListener("storage", onPrefs);
    return () => {
      window.removeEventListener("habitlife:prefs", onPrefs);
      window.removeEventListener("storage", onPrefs);
    };
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Cosmic animated background */}
      <div className="pointer-events-none absolute inset-0">
        {prefs.cosmicBackground ? (
          <div className="absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(900px 600px at 50% 35%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(700px 520px at 18% 65%, rgba(56,189,248,0.12), transparent 65%), radial-gradient(760px 540px at 82% 72%, rgba(217,70,239,0.10), transparent 62%)",
                animation: "nebulaShift 90s ease-in-out infinite"
              }}
            />
          </div>
        ) : null}

        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "20px 20px",
            animation: "starDrift 80s ease-in-out infinite"
          }}
        />
      </div>

      {/* Mobile top bar */}
      <div className="relative z-10 lg:hidden px-4 pt-4">
        <div className="glass rounded-[22px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-2xl bg-white/10 border border-white/10 grid place-items-center">
              <Sparkles className="h-4 w-4 text-indigo-200" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">HabitLife</div>
              <div className="text-xs text-slate-400 truncate">{email || "—"}</div>
            </div>
          </div>
          <button className="btn btn-ghost px-3" onClick={() => setMobileOpen(true)} type="button">
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Layout */}
      <div className="relative z-10 mx-auto w-full max-w-[1760px] px-4 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:[grid-template-columns:320px_minmax(0,1fr)] gap-6">
          {/* Sidebar desktop */}
          <div className="hidden lg:block sticky top-6 self-start">
            <SidebarContent email={email} initials={initials} onSignOut={onSignOut} online={online} prefs={prefs} />
          </div>

          {/* Center */}
          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <motion.div
              initial={{ x: -24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute left-3 top-3 bottom-3 w-[min(360px,92vw)]"
            >
              <div className="mb-3 flex justify-end">
                <button className="btn btn-ghost px-3" onClick={() => setMobileOpen(false)} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <SidebarContent email={email} initials={initials} onSignOut={onSignOut} online={online} prefs={prefs} />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
