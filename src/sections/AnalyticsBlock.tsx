import { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import ProgressBar from "../components/ProgressBar";
import type { EntryRow, HabitRow, NutritionKeys } from "../lib/types";
import { NUTRITION_HABIT_NAMES } from "../lib/types";
import { rangeISO, fromISODate, toISODate } from "../lib/date";
import { getEntriesByRange } from "../lib/db";
import { addDays, format, startOfWeek, startOfMonth } from "date-fns";
import Segmented from "../components/Segmented";
import Skeleton from "../components/Skeleton";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area
} from "recharts";

type Period = 7 | 30 | 365;
type Granularity = "daily" | "weekly" | "monthly";

function periodLabel(p: Period) {
  if (p === 7) return "7d";
  if (p === 30) return "30d";
  return "365d";
}

function defaultPeriod(): Period {
  return 30;
}

function normalizeGranularity(period: Period, g: Granularity) {
  if (period !== 365) return "daily";
  return g;
}

type Point = { name: string; value: number; meta: string };

function bucketLabel(granularity: Granularity, d: Date) {
  if (granularity === "monthly") return format(d, "MMM");
  if (granularity === "weekly") return format(d, "MMM d");
  return format(d, "MMM d");
}

function aggregate(
  entries: EntryRow[],
  habit: HabitRow,
  startISO: string,
  endISO: string,
  granularity: Granularity
): Point[] {
  const start = fromISODate(startISO);
  const end = fromISODate(endISO);

  const byDate = new Map<string, EntryRow>();
  for (const e of entries) if (e.habit_id === habit.id) byDate.set(e.date, e);

  const buckets = new Map<string, { key: string; start: Date; days: number; done: number; sum: number }>();

  for (let d = start; d <= end; d = addDays(d, 1)) {
    const iso = toISODate(d);

    let bStart = d;
    if (granularity === "weekly") bStart = startOfWeek(d, { weekStartsOn: 1 });
    if (granularity === "monthly") bStart = startOfMonth(d);

    const bKey = toISODate(bStart);
    if (!buckets.has(bKey)) buckets.set(bKey, { key: bKey, start: bStart, days: 0, done: 0, sum: 0 });

    const bucket = buckets.get(bKey)!;
    bucket.days += 1;

    const e = byDate.get(iso);
    if (!e) continue;

    if (habit.type === "toggle") {
      if (e.value_bool) bucket.done += 1;
    } else {
      bucket.sum += Number(e.value_num ?? 0);
    }
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));

  return sorted.map((b) => {
    const label = bucketLabel(granularity, b.start);
    if (habit.type === "toggle") {
      const rate = b.days ? (b.done / b.days) * 100 : 0;
      const meta = `${b.done}/${b.days} days`;
      return { name: label, value: Math.round(rate), meta };
    }
    const meta = granularity === "daily" ? "day" : granularity === "weekly" ? "week" : "month";
    return { name: label, value: Math.round(b.sum * 100) / 100, meta };
  });
}

function niceInterval(points: number) {
  if (points <= 12) return 0;
  if (points <= 24) return 1;
  if (points <= 60) return 3;
  return 6;
}

function TooltipGlass({
  active,
  payload,
  label
}: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as Point | undefined;
  return (
    <div className="glass-2 rounded-2xl px-3 py-2">
      <div className="text-xs text-slate-300">{label}</div>
      <div className="text-sm font-semibold mt-0.5">{payload[0]?.value}</div>
      {p?.meta ? <div className="text-[11px] text-slate-400 mt-0.5">{p.meta}</div> : null}
    </div>
  );
}

export default function AnalyticsBlock({
  dateISO,
  habits,
  nutritionEnabled
}: {
  dateISO: string;
  habits: HabitRow[];
  nutritionEnabled: boolean;
}) {
  const [period, setPeriod] = useState<Period>(defaultPeriod());
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [selectedHabitId, setSelectedHabitId] = useState<string>("");
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [yearEntries, setYearEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const filteredHabits = useMemo(() => {
    return habits.filter((h) => h.enabled && !h.name.startsWith("Nutrition •"));
  }, [habits]);

  useEffect(() => {
    if (!selectedHabitId && filteredHabits.length) setSelectedHabitId(filteredHabits[0].id);
  }, [filteredHabits, selectedHabitId]);

  const selectedHabit = useMemo(
    () => filteredHabits.find((h) => h.id === selectedHabitId) ?? null,
    [filteredHabits, selectedHabitId]
  );

  const nutritionHabits = useMemo(() => {
    return habits.filter((h) => h.enabled && h.name.startsWith("Nutrition •"));
  }, [habits]);

  useEffect(() => {
    if (!selectedHabit) return;
    (async () => {
      setLoading(true);
      try {
        const end = fromISODate(dateISO);
        const start = addDays(end, -(period - 1));
        const startISO = toISODate(start);
        const endISO = dateISO;
        const data = await getEntriesByRange(startISO, endISO);
        setEntries(data);

        // year entries for goals
        const year = fromISODate(dateISO).getFullYear();
        const yearStartISO = `${year}-01-01`;
        const yearEndISO = `${year}-12-31`;
        const yd = await getEntriesByRange(yearStartISO, yearEndISO);
        setYearEntries(yd);
      } finally {
        setLoading(false);
      }
    })();
  }, [period, dateISO, selectedHabitId]);

  const effectiveGranularity = normalizeGranularity(period, granularity);

  const startISO = useMemo(() => {
    const end = fromISODate(dateISO);
    return toISODate(addDays(end, -(period - 1)));
  }, [dateISO, period]);

  const series = useMemo(() => {
    if (!selectedHabit) return [];
    return aggregate(entries, selectedHabit, startISO, dateISO, effectiveGranularity);
  }, [entries, selectedHabit, startISO, dateISO, effectiveGranularity]);

  // Habit score (toggle habits only)
  const scorePack = useMemo(() => {
    const toggles = filteredHabits.filter((h) => h.type === "toggle");
    if (!toggles.length) return null;

    const start = fromISODate(startISO);
    const end = fromISODate(dateISO);

    const byHabitDate = new Map<string, boolean>();
    for (const e of entries) {
      if (e.value_bool == null) continue;
      byHabitDate.set(`${e.habit_id}:${e.date}`, Boolean(e.value_bool));
    }

    let done = 0;
    let total = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const iso = toISODate(d);
      for (const h of toggles) {
        total += 1;
        if (byHabitDate.get(`${h.id}:${iso}`)) done += 1;
      }
    }

    const ratio = total ? done / total : 0;
    return { ratio, done, total };
  }, [entries, filteredHabits, startISO, dateISO]);

  // Year goals
  const yearGoals = useMemo(() => {
    const year = fromISODate(dateISO).getFullYear();
    const yearStartISO = `${year}-01-01`;
    const yearEndISO = `${year}-12-31`;

    const out: Array<{ habit: HabitRow; goal: number; done: number; ratio: number }> = [];
    for (const h of filteredHabits) {
      if (!h.year_goal || h.year_goal <= 0) continue;

      const pts = aggregate(yearEntries, h, yearStartISO, yearEndISO, "monthly");
      const sum = h.type === "toggle"
        ? Math.round((pts.reduce((a, p) => a + p.value, 0) / 100) * 365) / 365  // not used; keep simple below
        : pts.reduce((a, p) => a + p.value, 0);

      // Better: compute done as raw for year
      let done = 0;
      for (const e of yearEntries) {
        if (e.habit_id !== h.id) continue;
        if (h.type === "toggle") done += e.value_bool ? 1 : 0;
        else done += Number(e.value_num ?? 0);
      }

      const ratio = Math.min(1, done / h.year_goal);
      out.push({ habit: h, goal: h.year_goal, done, ratio });
    }
    return out.sort((a, b) => b.ratio - a.ratio).slice(0, 6);
  }, [filteredHabits, yearEntries, dateISO]);

  const nutritionSummary = useMemo(() => {
    const sums = { calories: 0, protein: 0, fat: 0, carbs: 0 } as Record<NutritionKeys, number>;
    if (!nutritionEnabled) return sums;

    const map = new Map<string, HabitRow>();
    nutritionHabits.forEach((h) => map.set(h.name, h));

    const idByKey: Partial<Record<NutritionKeys, string>> = {};
    (Object.keys(NUTRITION_HABIT_NAMES) as NutritionKeys[]).forEach((k) => {
      const h = map.get(NUTRITION_HABIT_NAMES[k]);
      if (h) idByKey[k] = h.id;
    });

    for (const e of entries) {
      for (const k of Object.keys(idByKey) as NutritionKeys[]) {
        if (e.habit_id === idByKey[k]) sums[k] += Number(e.value_num ?? 0);
      }
    }
    return sums;
  }, [entries, nutritionEnabled, nutritionHabits]);

  const chartIsToggle = selectedHabit?.type === "toggle";
  const yDomain = chartIsToggle ? [0, 100] : undefined;

  return (
    <div className="space-y-6">
      <Card
        title="Analytics"
        right={
          <Segmented
            value={String(period) as any}
            options={[
              { value: "7" as any, label: "7d" },
              { value: "30" as any, label: "30d" },
              { value: "365" as any, label: "365d" }
            ]}
            onChange={(v) => setPeriod(Number(v) as Period)}
          />
        }
      >
        <div className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="label mb-1">Trend habit</div>
              <select className="input" value={selectedHabitId} onChange={(e) => setSelectedHabitId(e.target.value)}>
                {filteredHabits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="min-w-0">
                <div className="label mb-1">Granularity</div>
                {period !== 365 ? (
                  <div className="chip">Daily</div>
                ) : (
                  <Segmented
                    value={granularity}
                    options={[
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" }
                    ]}
                    onChange={setGranularity}
                  />
                )}
              </div>
              <div className="chip">
                {chartIsToggle ? "Completion %" : selectedHabit?.type ?? "—"}
              </div>
            </div>
          </div>

          <div className="glass-subtle rounded-2xl p-3">
            <div className="h-64">
              {loading ? (
                <div className="h-full grid place-items-center">
                  <Skeleton className="h-52 w-full" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartIsToggle ? (
                    <AreaChart data={series}>
                      <defs>
                        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(99,102,241,.55)" />
                          <stop offset="100%" stopColor="rgba(99,102,241,0)" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={niceInterval(series.length)} />
                      <YAxis tick={{ fontSize: 12 }} domain={yDomain as any} />
                      <Tooltip content={<TooltipGlass />} />
                      <Area type="monotone" dataKey="value" strokeWidth={2} stroke="rgba(165,180,252,.9)" fill="url(#g)" dot={false} />
                    </AreaChart>
                  ) : (
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={niceInterval(series.length)} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<TooltipGlass />} />
                      <Line type="monotone" dataKey="value" strokeWidth={2} dot={false} stroke="rgba(165,180,252,.9)" />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {loading ? "Loading…" : selectedHabit ? `${selectedHabit.name}` : "—"}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Habit score" tone="subtle">
        {!scorePack ? (
          <div className="text-sm text-slate-400">Add at least one toggle habit to get a score.</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="text-slate-200">Toggle completion</div>
              <div className="text-slate-300">{Math.round(scorePack.ratio * 100)}%</div>
            </div>
            <ProgressBar value={scorePack.ratio} />
            <div className="text-xs text-slate-500">
              Completed <span className="text-slate-200">{scorePack.done}</span> /{" "}
              <span className="text-slate-200">{scorePack.total}</span> checks in this period.
            </div>
          </div>
        )}
      </Card>

      <Card title="Year goals progress" tone="subtle">
        {yearGoals.length === 0 ? (
          <div className="text-sm text-slate-400">Set a Year goal in Settings to see progress.</div>
        ) : (
          <div className="space-y-3">
            {yearGoals.map(({ habit, goal, done, ratio }) => (
              <div key={habit.id} className="glass-subtle rounded-2xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{habit.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {Math.round(done * 100) / 100} / {goal}
                      <span className="ml-2 opacity-70">• {habit.type}</span>
                    </div>
                  </div>
                  <div className="text-sm text-slate-300">{Math.round(ratio * 100)}%</div>
                </div>
                <ProgressBar value={ratio} className="mt-2" />
              </div>
            ))}
          </div>
        )}
      </Card>

      {nutritionEnabled ? (
        <Card title="Nutrition summary" tone="subtle">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {(["calories", "protein", "fat", "carbs"] as NutritionKeys[]).map((k) => (
              <div key={k} className="glass-subtle rounded-2xl p-3">
                <div className="label">{k === "calories" ? "Calories" : k[0].toUpperCase() + k.slice(1)}</div>
                <div className="text-lg font-semibold mt-1">{Math.round(nutritionSummary[k])}</div>
                <div className="hidden sm:block text-[11px] text-slate-500 mt-0.5">Total for period</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
