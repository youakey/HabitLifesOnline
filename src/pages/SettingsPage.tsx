import { useEffect, useMemo, useState } from "react";
import Page from "../components/Page";
import Card from "../components/Card";
import Switch from "../components/Switch";
import Segmented from "../components/Segmented";
import { ArrowDown, ArrowUp, Plus, Trash2, Pencil, X, Sparkles, User2, Moon } from "lucide-react";
import type { HabitRow, HabitType } from "../lib/types";
import {
  ensureNutritionHabits,
  ensureSettingsRow,
  getHabits,
  getSession,
  getSettings,
  updateHabit,
  createHabit,
  deleteHabit,
  updateSettings,
  getProfile,
  upsertProfile,
  applyTemplate,
  recalcMyScore
} from "../lib/db";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../components/Toast";
import { defaultPrefs, loadPrefs, savePrefs, type UIPrefs } from "../lib/prefs";

const types: HabitType[] = ["toggle", "minutes", "hours", "count"];

function typeLabel(t: HabitType) {
  if (t === "toggle") return "Toggle";
  if (t === "minutes") return "Minutes";
  if (t === "hours") return "Hours";
  return "Count";
}

type Tab = "habits" | "modules" | "account";

export default function SettingsPage() {
  const toast = useToast();
  const notify = {
    success: (title: string, detail?: string) => toast.push({ kind: "success", title, detail }),
    error: (title: string, detail?: string) => toast.push({ kind: "error", title, detail }),
    info: (title: string, detail?: string) => toast.push({ kind: "info", title, detail }),
  };
  const [tab, setTab] = useState<Tab>("habits");

  const [busy, setBusy] = useState(false);
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modules
  const [nutritionEnabled, setNutritionEnabled] = useState(false);
  const [sleepEnabled, setSleepEnabled] = useState(false);

  // Account/Profile
  const [email, setEmail] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [profilePublic, setProfilePublic] = useState<boolean>(true);

  // UI preferences (local)
  const [uiPrefs, setUiPrefs] = useState<UIPrefs>(defaultPrefs);

  // Edit modal
  const [editing, setEditing] = useState<null | HabitRow>(null);

  useEffect(() => {
    setUiPrefs(loadPrefs());
    const onPrefs = () => setUiPrefs(loadPrefs());
    window.addEventListener("habitlife:prefs", onPrefs);
    window.addEventListener("storage", onPrefs);
    return () => {
      window.removeEventListener("habitlife:prefs", onPrefs);
      window.removeEventListener("storage", onPrefs);
    };
  }, []);

  function updatePref<K extends keyof UIPrefs>(key: K, value: UIPrefs[K]) {
    const next = { ...uiPrefs, [key]: value };
    setUiPrefs(next);
    savePrefs(next);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const { data: s } = await getSession();
      const user = s.session?.user;
      if (!user) return;

      setEmail(user.email ?? "");

      await ensureSettingsRow(user.id);
      const [hs, st, prof] = await Promise.all([getHabits(), getSettings(user.id), getProfile(user.id)]);

      setHabits(hs);
      setNutritionEnabled(Boolean(st?.nutrition_enabled));
      setSleepEnabled(Boolean(st?.sleep_enabled));

      setUsername(prof?.username ?? "");
      setProfilePublic(prof?.public ?? true);
    } catch (e: any) {
      notify.error(e?.message ?? "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userHabits = useMemo(() => habits.filter((h) => !h.name.startsWith("Nutrition •")), [habits]);
  const visibleHabits = useMemo(() => userHabits.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)), [userHabits]);
  const maxSort = useMemo(() => visibleHabits.reduce((m, h) => Math.max(m, h.sort ?? 0), 0), [visibleHabits]);

  async function toggleNutrition(next: boolean) {
    setBusy(true);
    try {
      const { data: s } = await getSession();
      const userId = s.session?.user.id;
      if (!userId) return;

      const st = await updateSettings(userId, { nutrition_enabled: next });
      setNutritionEnabled(st.nutrition_enabled);

      if (next) {
        const hs = await getHabits();
        await ensureNutritionHabits(hs);
      }
      setHabits(await getHabits());

      notify.success("Saved", "Modules updated.");
    } catch (e: any) {
      notify.error("Update failed", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSleep(next: boolean) {
    setBusy(true);
    try {
      const { data: s } = await getSession();
      const userId = s.session?.user.id;
      if (!userId) return;

      const st = await updateSettings(userId, { sleep_enabled: next });
      setSleepEnabled(st.sleep_enabled);
      notify.success("Saved", "Modules updated.");
    } catch (e: any) {
      notify.error("Update failed", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAccount() {
    const clean = username.trim();
    if (!clean) {
      notify.info("Username required", "Please enter a username.");
      return;
    }
    setBusy(true);
    try {
      const { data: s } = await getSession();
      const userId = s.session?.user.id;
      if (!userId) return;

      await upsertProfile(userId, { username: clean, public: profilePublic });
      await recalcMyScore();
      notify.success("Saved", "Profile updated.");
    } catch (e: any) {
      notify.error("Save failed", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function addHabit() {
    setBusy(true);
    try {
      const created = await createHabit({
        name: "New habit",
        type: "toggle",
        target_daily: null,
        year_goal: null,
        sort: maxSort + 1,
        enabled: true
      });
      setHabits((prev) => [...prev, created]);
      setEditing(created);
    } catch (e: any) {
      notify.error("Create failed", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function move(id: string, dir: -1 | 1) {
    const list = [...visibleHabits];
    const idx = list.findIndex((h) => h.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx];
    const b = list[swapIdx];

    setBusy(true);
    try {
      await Promise.all([updateHabit(a.id, { sort: b.sort }), updateHabit(b.id, { sort: a.sort })]);
      await loadAll();
    } finally {
      setBusy(false);
    }
  }

  async function remove(habitId: string) {
    setBusy(true);
    try {
      await deleteHabit(habitId);
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
      notify.success("Deleted", "Habit removed.");
    } catch (e: any) {
      notify.error("Delete failed", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEditing(next: HabitRow) {
    setBusy(true);
    try {
      await updateHabit(next.id, {
        name: next.name,
        type: next.type,
        year_goal: next.year_goal,
        enabled: next.enabled,
        target_daily: next.target_daily
      });
      setHabits((prev) => prev.map((h) => (h.id === next.id ? next : h)));
      notify.success("Saved", "Habit updated.");
      setEditing(null);
    } catch (e: any) {
      notify.error("Save failed", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onTemplate() {
    setBusy(true);
    try {
      await applyTemplate();
      await loadAll();
      notify.success("Template applied", "Starter trackers were added.");
    } catch (e: any) {
      notify.error("Template failed", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <div className="space-y-6">
        <Card
          title="Settings"
          right={
            <Segmented
              value={tab}
              options={[
                { value: "habits", label: "Habits" },
                { value: "modules", label: "Modules" },
                { value: "account", label: "Account" }
              ]}
              onChange={setTab}
            />
          }
        >
          {tab === "account" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-subtle rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User2 className="h-4 w-4 text-slate-200" />
                  <div className="text-sm font-semibold">Profile</div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="label mb-1">Email</div>
                    <div className="input opacity-70 cursor-not-allowed select-text">{email || "—"}</div>
                  </div>
                  <div>
                    <div className="label mb-1">Username</div>
                    <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your public name" />
                    <div className="hint">Used in Profile and Leaderboard.</div>
                  </div>
                  <div className="flex items-center justify-between glass-subtle rounded-2xl p-3">
                    <div>
                      <div className="text-sm font-medium">Public profile</div>
                      <div className="hint mt-0.5">Allow showing you in the leaderboard.</div>
                    </div>
                    <Switch checked={profilePublic} onChange={setProfilePublic} />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button className="btn btn-primary" onClick={saveAccount} disabled={busy} type="button">
                      Save
                    </button>
                  </div>
                </div>
              </div>

              <div className="glass-subtle rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-indigo-200" />
                  <div className="text-sm font-semibold">What gives XP</div>
                </div>
                <div className="text-sm text-slate-300 space-y-2">
                  <div>• Completing toggle habits</div>
                  <div>• Logging time / count habits</div>
                  <div>• Writing Daily reflection</div>
                  <div>• Filling Sleep tracker (if enabled)</div>
                </div>
                <div className="hint mt-3">
                  Streak increases only for real daily activity (server-verified timestamps).
                </div>
              </div>
            </div>
          ) : tab === "modules" ? (
            <div className="space-y-4">
              <div className="glass-subtle rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Moon className="h-4 w-4 text-slate-200" />
                  <div className="text-sm font-semibold">Modules</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="glass-subtle rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Enable Nutrition</div>
                      <div className="hint mt-0.5">Calories / protein / fat / carbs</div>
                    </div>
                    <Switch checked={nutritionEnabled} onChange={toggleNutrition} />
                  </div>

                  <div className="glass-subtle rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">Enable Sleep</div>
                      <div className="hint mt-0.5">Bed / wake / screen habits</div>
                    </div>
                    <Switch checked={sleepEnabled} onChange={toggleSleep} />
                  </div>
                </div>

                <div className="hint mt-3">
                  Disabled modules disappear from Habits and Analytics.
                </div>
              </div>

              <div className="glass-subtle rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Interface</div>
                    <div className="hint">Saved locally in your browser.</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="glass-subtle rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Animations</div>
                      <div className="hint">Page transitions & micro-interactions</div>
                    </div>
                    <Switch checked={uiPrefs.animations} onChange={(v) => updatePref("animations", v)} />
                  </div>

                  <div className="glass-subtle rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Cosmic background</div>
                      <div className="hint">Slow nebula shimmer</div>
                    </div>
                    <Switch checked={uiPrefs.cosmicBackground} onChange={(v) => updatePref("cosmicBackground", v)} />
                  </div>

                  <div className="glass-subtle rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Show Profile</div>
                      <div className="hint">Gamified overview</div>
                    </div>
                    <Switch checked={uiPrefs.showProfile} onChange={(v) => updatePref("showProfile", v)} />
                  </div>

                  <div className="glass-subtle rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Show Daily reflection</div>
                      <div className="hint">Notes history page</div>
                    </div>
                    <Switch checked={uiPrefs.showReflection} onChange={(v) => updatePref("showReflection", v)} />
                  </div>

                  <div className="glass-subtle rounded-2xl p-3 flex items-center justify-between md:col-span-2">
                    <div>
                      <div className="text-sm font-medium">Show Analytics</div>
                      <div className="hint">Charts & goals</div>
                    </div>
                    <Switch checked={uiPrefs.showAnalytics} onChange={(v) => updatePref("showAnalytics", v)} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="hint">Reorder, enable/disable, set targets and year goals.</div>
                <div className="flex items-center gap-2">
                  <button className="btn btn-ghost" onClick={onTemplate} disabled={busy} type="button">
                    <Sparkles className="h-4 w-4" />
                    Template
                  </button>
                  <button className="btn btn-primary" onClick={addHabit} disabled={busy} type="button">
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-sm text-slate-400">Loading…</div>
              ) : visibleHabits.length === 0 ? (
                <div className="text-sm text-slate-400">No habits yet.</div>
              ) : (
                <div className="space-y-2">
                  {visibleHabits.map((h, i) => (
                    <div key={h.id} className="glass-subtle rounded-2xl p-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <div className="text-sm font-medium truncate max-w-[28ch]">{h.name}</div>
                          <span className="chip">{typeLabel(h.type)}</span>
                          {h.target_daily ? <span className="chip">Target {h.target_daily}</span> : null}
                          {h.year_goal ? <span className="chip">Year {h.year_goal}</span> : null}
                          {!h.enabled ? <span className="chip chip-warn">Disabled</span> : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button className="btn btn-ghost h-9 w-9 p-0" onClick={() => move(h.id, -1)} disabled={busy || i === 0} type="button">
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button className="btn btn-ghost h-9 w-9 p-0" onClick={() => move(h.id, 1)} disabled={busy || i === visibleHabits.length - 1} type="button">
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button className="btn h-9" onClick={() => setEditing(h)} disabled={busy} type="button">
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button className="btn btn-ghost h-9 w-9 p-0" onClick={() => remove(h.id)} disabled={busy} type="button">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <AnimatePresence>
        {editing ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setEditing(null)} />
            <motion.div
              initial={{ y: 10, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-lg glass rounded-3xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="h1">Edit habit</div>
                <button className="btn btn-ghost h-9 w-9 p-0" onClick={() => setEditing(null)} type="button">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <div className="label mb-1">Name</div>
                  <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <div className="label mb-1">Type</div>
                    <select className="input" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as HabitType })}>
                      {types.map((t) => (
                        <option key={t} value={t}>
                          {typeLabel(t)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <div className="label mb-1">Target daily</div>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={editing.target_daily ?? ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          target_daily: e.target.value === "" ? null : Number(e.target.value)
                        })
                      }
                    />
                  </label>
                </div>

                <label className="block">
                  <div className="label mb-1">Year goal</div>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={editing.year_goal ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        year_goal: e.target.value === "" ? null : Number(e.target.value)
                      })
                    }
                  />
                </label>

                <div className="flex items-center justify-between glass-subtle rounded-2xl p-3">
                  <div>
                    <div className="text-sm font-medium">Enabled</div>
                    <div className="hint mt-0.5">Disable to hide from Habits and Analytics.</div>
                  </div>
                  <Switch checked={editing.enabled} onChange={(v) => setEditing({ ...editing, enabled: v })} />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button className="btn btn-ghost" type="button" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={() => saveEditing(editing)} disabled={busy}>
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Page>
  );
}
