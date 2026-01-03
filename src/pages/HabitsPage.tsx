import { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/Card";
import Switch from "../components/Switch";
import Page from "../components/Page";
import Stepper from "../components/Stepper";
import Skeleton from "../components/Skeleton";
import { Calendar, CheckCircle2, CloudOff, Loader2, Flame, ArrowRight, Moon } from "lucide-react";
import { toISODate } from "../lib/date";
import type { HabitRow, NutritionKeys, SleepLogRow } from "../lib/types";
import { NUTRITION_HABIT_NAMES } from "../lib/types";
import {
  ensureNutritionHabits,
  ensureSettingsRow,
  getDailyNote,
  getEntriesForDate,
  getEntriesByRange,
  getHabits,
  getSession,
  getSettings,
  upsertDailyNote,
  upsertEntries,
  getSleepLog,
  upsertSleepLog,
  recalcMyScore
} from "../lib/db";
import { useToast } from "../components/Toast";
import { addDays } from "date-fns";
import { cn } from "../lib/ui";
import { Link } from "react-router-dom";

type HabitDraft = { habitId: string; type: HabitRow["type"]; valueBool: boolean; valueNum: number | null };

function AutoSaveBadge({ saving, offline }: { saving: boolean; offline: boolean }) {
  if (offline) {
    return (
      <span className="chip chip-bad">
        <CloudOff className="h-3.5 w-3.5" />
        Offline
      </span>
    );
  }
  if (saving) {
    return (
      <span className="chip">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  return (
    <span className="chip chip-good">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Auto-save
    </span>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-subtle rounded-2xl p-3 flex items-center justify-between gap-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function YearMini({ done, goal }: { done: number; goal: number }) {
  const pct = goal ? Math.min(1, done / goal) : 0;
  return (
    <div className="mt-2">
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-white/30" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <div className="text-[11px] text-slate-500 mt-1">
        Year: {done} / {goal} ({Math.round(pct * 100)}%)
      </div>
    </div>
  );
}

function HabitRowItem({
  habit,
  value,
  onChange,
  yearDone
}: {
  habit: HabitRow;
  value: HabitDraft;
  onChange: (v: HabitDraft) => void;
  yearDone?: { done: number; goal: number } | null;
}) {
  const isToggle = habit.type === "toggle";
  return (
    <div className="glass-subtle rounded-2xl p-3 flex items-center gap-3 hover:border-white/20 transition">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{habit.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {isToggle ? (value.valueBool ? "Done today" : "Not done") : habit.target_daily ? `Target: ${habit.target_daily}` : " "}
            </div>
          </div>
          {isToggle ? (
            <Switch checked={value.valueBool} onChange={(v) => onChange({ ...value, valueBool: v })} />
          ) : null}
        </div>

        {!isToggle ? (
          <div className="mt-3 flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              {habit.type === "minutes" ? (
                <button className="chip hover:bg-white/20 transition" onClick={() => onChange({ ...value, valueNum: (value.valueNum ?? 0) + 5 })} type="button">
                  +5m
                </button>
              ) : null}
              {habit.type === "hours" ? (
                <button className="chip hover:bg-white/20 transition" onClick={() => onChange({ ...value, valueNum: (value.valueNum ?? 0) + 1 })} type="button">
                  +1h
                </button>
              ) : null}
              {habit.type === "count" ? (
                <button className="chip hover:bg-white/20 transition" onClick={() => onChange({ ...value, valueNum: (value.valueNum ?? 0) + 1 })} type="button">
                  +1
                </button>
              ) : null}
            </div>

            <Stepper value={value.valueNum ?? 0} onChange={(n) => onChange({ ...value, valueNum: n })} step={habit.type === "minutes" ? 5 : 1} min={0} />
          </div>
        ) : null}

        {yearDone ? <YearMini done={yearDone.done} goal={yearDone.goal} /> : null}
      </div>
    </div>
  );
}

function calcSleepHours(bed: string, wake: string) {
  // HH:MM -> hours, supports passing midnight
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  if ([bh, bm, wh, wm].some((x) => Number.isNaN(x))) return null;

  const b = bh * 60 + bm;
  const w = wh * 60 + wm;
  const diff = w >= b ? w - b : 1440 - b + w;
  return Math.round((diff / 60) * 10) / 10;
}

export default function HabitsPage() {
  const toast = useToast();

  const [dateISO, setDateISO] = useState(toISODate(new Date()));
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [draft, setDraft] = useState<Record<string, HabitDraft>>({});
  const [notes, setNotes] = useState<{ gratitude: string; improve: string }>({ gratitude: "", improve: "" });

  const [nutritionEnabled, setNutritionEnabled] = useState(false);
  const [sleepEnabled, setSleepEnabled] = useState(false);

  const [sleep, setSleep] = useState<{
    bed_time: string;
    wake_time: string;
    screen_before_bed: boolean;
    screen_after_wake: boolean;
  }>({ bed_time: "", wake_time: "", screen_before_bed: false, screen_after_wake: false });

  const [yearDone, setYearDone] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);

  const loadingRef = useRef(false);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const enabledHabits = useMemo(() => habits.filter((h) => h.enabled && !h.name.startsWith("Nutrition •")), [habits]);

  const groups = useMemo(() => {
    return {
      toggle: enabledHabits.filter((h) => h.type === "toggle"),
      time: enabledHabits.filter((h) => h.type === "minutes" || h.type === "hours"),
      count: enabledHabits.filter((h) => h.type === "count")
    };
  }, [enabledHabits]);

  const nutritionHabits = useMemo(() => {
    const map = new Map<string, HabitRow>();
    habits.filter((h) => h.name.startsWith("Nutrition •")).forEach((h) => map.set(h.name, h));
    return map;
  }, [habits]);

  function scheduleSave() {
    if (offline) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => saveAll("auto"), 450);
  }

  function setHabitDraft(habit: HabitRow, next: HabitDraft) {
    setDraft((prev) => ({ ...prev, [habit.id]: next }));
    dirtyRef.current = true;
    scheduleSave();
  }

  async function loadAll() {
    loadingRef.current = true;
    setLoading(true);
    try {
      const { data: s } = await getSession();
      const userId = s.session?.user.id;
      if (!userId) return;

      await ensureSettingsRow(userId);

      const [hs, st, es, dn, sl] = await Promise.all([
        getHabits(),
        getSettings(userId),
        getEntriesForDate(dateISO),
        getDailyNote(dateISO),
        getSleepLog(dateISO)
      ]);

      setHabits(hs);
      setNutritionEnabled(Boolean(st?.nutrition_enabled));
      setSleepEnabled(Boolean(st?.sleep_enabled));

      const nextDraft: Record<string, HabitDraft> = {};
      for (const h of hs.filter((x) => x.enabled)) {
        const e = es.find((x) => x.habit_id === h.id);
        nextDraft[h.id] = {
          habitId: h.id,
          type: h.type,
          valueBool: Boolean(e?.value_bool),
          valueNum: e?.value_num ?? 0
        };
      }
      setDraft(nextDraft);

      setNotes({ gratitude: dn?.gratitude ?? "", improve: dn?.improve ?? "" });

      setSleep({
        bed_time: sl?.bed_time ?? "",
        wake_time: sl?.wake_time ?? "",
        screen_before_bed: Boolean(sl?.screen_before_bed),
        screen_after_wake: Boolean(sl?.screen_after_wake)
      });

      dirtyRef.current = false;

      if (st?.nutrition_enabled) {
        await ensureNutritionHabits(hs);
        setHabits(await getHabits());
      }
    } catch (e: any) {
      toast.push({ kind: "error", title: "Load error", detail: e?.message ?? "Unknown error" });
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  async function computeYearDone() {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const startISO = toISODate(start);
    const endISO = toISODate(now);
    const entries = await getEntriesByRange(startISO, endISO);

    const map: Record<string, number> = {};
    for (const e of entries) {
      const v = (e.value_bool ? 1 : 0) + (e.value_num ?? 0);
      map[e.habit_id] = (map[e.habit_id] ?? 0) + v;
    }
    setYearDone(map);
  }

  useEffect(() => {
    computeYearDone().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits]);

  async function saveAll(kind: "auto" | "manual") {
    if (offline) return;
    if (!dirtyRef.current && kind === "auto") return;
    if (loadingRef.current) return;

    setSaving(true);
    try {
      const { data: s } = await getSession();
      const userId = s.session?.user.id;
      if (!userId) return;

      const entriesPayload = Object.values(draft)
        .filter((d) => {
          if (d.type === "toggle") return true;
          return (d.valueNum ?? 0) > 0 || d.valueNum === 0;
        })
        .map((d) => ({
          habit_id: d.habitId,
          date: dateISO,
          value_bool: d.type === "toggle" ? d.valueBool : null,
          value_num: d.type !== "toggle" ? d.valueNum ?? 0 : null
        }));

      await Promise.all([
        upsertEntries(entriesPayload),
        upsertDailyNote({ date: dateISO, gratitude: notes.gratitude, improve: notes.improve }),
        sleepEnabled
          ? upsertSleepLog(dateISO, {
              bed_time: sleep.bed_time || null,
              wake_time: sleep.wake_time || null,
              sleep_hours: sleep.bed_time && sleep.wake_time ? calcSleepHours(sleep.bed_time, sleep.wake_time) : null,
              screen_before_bed: sleep.screen_before_bed,
              screen_after_wake: sleep.screen_after_wake
            })
          : Promise.resolve(null)
      ]);

      dirtyRef.current = false;

      try {
        await recalcMyScore();
      } catch {
        // ignore
      }

      if (kind !== "auto") toast.push({ kind: "success", title: "Saved", detail: "Changes saved" });
      computeYearDone().catch(() => {});
    } catch (e: any) {
      toast.push({ kind: "error", title: "Save error", detail: e?.message ?? "Unknown error" });
    } finally {
      setSaving(false);
    }
  }

  // summary stats
  const toggleToday = useMemo(() => {
    const toggles = groups.toggle;
    let done = 0;
    for (const h of toggles) {
      if ((draft[h.id]?.valueBool ?? false) === true) done++;
    }
    return { done, total: toggles.length };
  }, [groups.toggle, draft]);

  const habitScore = useMemo(() => {
    if (!toggleToday.total) return null;
    return Math.round((toggleToday.done / toggleToday.total) * 100);
  }, [toggleToday]);

  const momentum = useMemo(() => {
    let points = toggleToday.done;
    for (const h of [...groups.time, ...groups.count]) {
      if ((draft[h.id]?.valueNum ?? 0) > 0) points++;
    }
    return points;
  }, [toggleToday.done, groups.time, groups.count, draft]);

  return (
    <Page>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-6">
          <Card
            title="Day"
            right={
              <div className="flex items-center gap-2">
                <AutoSaveBadge saving={saving} offline={offline} />
                <button className="btn btn-ghost" onClick={() => loadAll()} type="button">
                  Refresh
                </button>
                <button className="btn btn-primary" onClick={() => saveAll("manual")} type="button">
                  Save
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4">
                <div className="label mb-1">Date</div>
                <div className="relative">
                  <Calendar className="h-4 w-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input className="input pl-9" type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
                </div>
              </div>

              <div className="sm:col-span-8">
                <div className="label mb-1">Quick stats</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <StatPill label="Toggle" value={`${toggleToday.done}/${toggleToday.total}`} />
                  <StatPill label="Habit score" value={habitScore === null ? "—" : `${habitScore}%`} />
                  <StatPill label="Momentum" value={`🔥 ${momentum}`} />
                </div>
              </div>
            </div>
          </Card>

          <Card title="Habits" subtitle="Daily check-in — compact, organized, always visible">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="title">Toggle</div>
                    <span className="chip">{groups.toggle.length}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {groups.toggle.map((h) => (
                      <HabitRowItem
                        key={h.id}
                        habit={h}
                        value={draft[h.id] ?? { habitId: h.id, type: h.type, valueBool: false, valueNum: 0 }}
                        onChange={(next) => setHabitDraft(h, next)}
                        yearDone={h.year_goal ? { done: yearDone[h.id] ?? 0, goal: h.year_goal } : null}
                      />
                    ))}
                    {!groups.toggle.length ? <div className="text-sm text-slate-400">No toggle habits.</div> : null}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div className="title">Time</div>
                    <span className="chip">{groups.time.length}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {groups.time.map((h) => (
                      <HabitRowItem
                        key={h.id}
                        habit={h}
                        value={draft[h.id] ?? { habitId: h.id, type: h.type, valueBool: false, valueNum: 0 }}
                        onChange={(next) => setHabitDraft(h, next)}
                        yearDone={h.year_goal ? { done: yearDone[h.id] ?? 0, goal: h.year_goal } : null}
                      />
                    ))}
                    {!groups.time.length ? <div className="text-sm text-slate-400">No time habits.</div> : null}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <div className="title">Count</div>
                    <span className="chip">{groups.count.length}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {groups.count.map((h) => (
                      <HabitRowItem
                        key={h.id}
                        habit={h}
                        value={draft[h.id] ?? { habitId: h.id, type: h.type, valueBool: false, valueNum: 0 }}
                        onChange={(next) => setHabitDraft(h, next)}
                        yearDone={h.year_goal ? { done: yearDone[h.id] ?? 0, goal: h.year_goal } : null}
                      />
                    ))}
                    {!groups.count.length ? <div className="text-sm text-slate-400">No count habits.</div> : null}
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card
            title="Daily reflection"
            subtitle="Lightweight notes for the day — view history anytime"
            right={
              <Link to="/reflection" className="btn btn-ghost">
                Open history <ArrowRight className="h-4 w-4" />
              </Link>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="label mb-1">Gratitude</div>
                <textarea
                  className="textarea h-32"
                  value={notes.gratitude}
                  onChange={(e) => {
                    setNotes((p) => ({ ...p, gratitude: e.target.value }));
                    dirtyRef.current = true;
                    scheduleSave();
                  }}
                  placeholder="3 things I’m grateful for today…"
                />
                <div className="text-[11px] text-slate-500 mt-1">{notes.gratitude.length} chars</div>
              </div>
              <div>
                <div className="label mb-1">Improve</div>
                <textarea
                  className="textarea h-32"
                  value={notes.improve}
                  onChange={(e) => {
                    setNotes((p) => ({ ...p, improve: e.target.value }));
                    dirtyRef.current = true;
                    scheduleSave();
                  }}
                  placeholder="If I could relive this day, I would…"
                />
                <div className="text-[11px] text-slate-500 mt-1">{notes.improve.length} chars</div>
              </div>
            </div>
          </Card>

          {sleepEnabled ? (
            <Card title="Sleep" subtitle="Track your night & screen habits">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="glass-subtle rounded-2xl p-3">
                  <div className="label mb-1">Bed time</div>
                  <input
                    className="input"
                    type="time"
                    value={sleep.bed_time}
                    onChange={(e) => {
                      setSleep((p) => ({ ...p, bed_time: e.target.value }));
                      dirtyRef.current = true;
                      scheduleSave();
                    }}
                  />
                </div>
                <div className="glass-subtle rounded-2xl p-3">
                  <div className="label mb-1">Wake time</div>
                  <input
                    className="input"
                    type="time"
                    value={sleep.wake_time}
                    onChange={(e) => {
                      setSleep((p) => ({ ...p, wake_time: e.target.value }));
                      dirtyRef.current = true;
                      scheduleSave();
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="glass-subtle rounded-2xl p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Screen before bed</div>
                    <div className="hint mt-0.5">Last hour, no screen</div>
                  </div>
                  <Switch
                    checked={!sleep.screen_before_bed}
                    onChange={(v) => {
                      // v = true means "no screen" => store screen_before_bed=false
                      setSleep((p) => ({ ...p, screen_before_bed: !v }));
                      dirtyRef.current = true;
                      scheduleSave();
                    }}
                  />
                </div>

                <div className="glass-subtle rounded-2xl p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Screen after wake</div>
                    <div className="hint mt-0.5">First hour, no screen</div>
                  </div>
                  <Switch
                    checked={!sleep.screen_after_wake}
                    onChange={(v) => {
                      setSleep((p) => ({ ...p, screen_after_wake: !v }));
                      dirtyRef.current = true;
                      scheduleSave();
                    }}
                  />
                </div>

                <div className="glass-subtle rounded-2xl p-3">
                  <div className="text-xs text-slate-400">Sleep hours</div>
                  <div className="text-2xl font-semibold mt-1">
                    {sleep.bed_time && sleep.wake_time ? `${calcSleepHours(sleep.bed_time, sleep.wake_time) ?? "—"}h` : "—"}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Auto-calculated</div>
                </div>
              </div>
            </Card>
          ) : null}

          {nutritionEnabled ? (
            <Card title="Nutrition" subtitle="Calories / protein / fat / carbs">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {(["calories", "protein", "fat", "carbs"] as NutritionKeys[]).map((k) => {
                  const habit = nutritionHabits.get(NUTRITION_HABIT_NAMES[k]);
                  if (!habit) return null;
                  const val = draft[habit.id]?.valueNum ?? 0;
                  return (
                    <div key={k} className="glass-subtle rounded-2xl p-3">
                      <div className="text-xs text-slate-400 capitalize">{k}</div>
                      <Stepper
                        value={val}
                        onChange={(n) => setHabitDraft(habit, { habitId: habit.id, type: habit.type, valueBool: false, valueNum: n })}
                        step={k === "calories" ? 50 : 5}
                        min={0}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="xl:col-span-4 space-y-6">
          <Card title="Today focus" subtitle="A clean summary — analytics lives in its own section">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="glass-subtle rounded-2xl p-4">
                <div className="text-xs text-slate-400">Toggle completion</div>
                <div className="text-2xl font-semibold mt-1">{habitScore === null ? "—" : `${habitScore}%`}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Completed {toggleToday.done} / {toggleToday.total}
                </div>
              </div>
              <div className="glass-subtle rounded-2xl p-4">
                <div className="text-xs text-slate-400">Momentum</div>
                <div className="text-2xl font-semibold mt-1">🔥 {momentum}</div>
                <div className="text-xs text-slate-500 mt-1">Small steps compound.</div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link to="/analytics" className="btn btn-primary flex-1 justify-center">
                Open Analytics
              </Link>
              <Link to="/profile" className="btn btn-ghost flex-1 justify-center">
                Profile
              </Link>
            </div>
          </Card>

          <Card title="Year goals preview" subtitle="Quick glance — deep dive in Analytics">
            <div className="space-y-2">
              {enabledHabits
                .filter((h) => (h.year_goal ?? 0) > 0)
                .slice(0, 7)
                .map((h) => {
                  const done = yearDone[h.id] ?? 0;
                  return (
                    <div key={h.id} className="glass-subtle rounded-2xl p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{h.name}</div>
                          <div className="text-xs text-slate-500">{h.type}</div>
                        </div>
                        <div className="text-sm text-slate-300">
                          {done}/{h.year_goal}{" "}
                          <span className="text-xs text-slate-500">
                            ({h.year_goal ? Math.min(100, Math.round((done / h.year_goal) * 100)) : 0}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-white/30"
                          style={{ width: `${h.year_goal ? Math.min(100, Math.round((done / h.year_goal) * 100)) : 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              {enabledHabits.filter((h) => (h.year_goal ?? 0) > 0).length === 0 ? (
                <div className="text-sm text-slate-400">No year goals yet. Set them in Settings.</div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
