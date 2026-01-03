import { supabase } from "./supabase";
import type {
  HabitRow,
  HabitType,
  EntryRow,
  DailyNoteRow,
  SettingsRow,
  ProfileRow,
  ScoreRow,
  SleepLogRow
} from "./types";
import { NUTRITION_HABIT_NAMES } from "./types";

export async function getSession() {
  return supabase.auth.getSession();
}

export async function signOut() {
  return supabase.auth.signOut();
}

/* =========================
   Settings / Modules
   ========================= */

export async function ensureSettingsRow(userId: string) {
  // Try to read (fast path)
  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return data as SettingsRow;

  // If missing (or race condition), create safely
  const { data: upserted, error } = await supabase
    .from("settings")
    .upsert(
      { user_id: userId, nutrition_enabled: false, sleep_enabled: false },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return upserted as SettingsRow;
}


export async function getSettings(userId: string) {
  const { data, error } = await supabase.from("settings").select("*").eq("user_id", userId).single();
  if (error) throw error;
  return data as SettingsRow;
}

export async function updateSettings(userId: string, patch: Partial<SettingsRow>) {
  // upsert makes toggles reliable even if the row was not created yet
  const { data, error } = await supabase
    .from("settings")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as SettingsRow;
}

/* =========================
   Habits
   ========================= */

export async function getHabits() {
  const { data, error } = await supabase.from("habits").select("*").order("sort", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HabitRow[];
}

export async function createHabit(habit: {
  name: string;
  type: HabitType;
  target_daily: number | null;
  year_goal: number | null;
  sort: number;
  enabled: boolean;
}) {
  const { data, error } = await supabase.from("habits").insert(habit).select("*").single();
  if (error) throw error;
  return data as HabitRow;
}

export async function updateHabit(id: string, patch: Partial<HabitRow>) {
  const { data, error } = await supabase.from("habits").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as HabitRow;
}

export async function deleteHabit(id: string) {
  const { error } = await supabase.from("habits").delete().eq("id", id);
  if (error) throw error;
}

export async function ensureNutritionHabits(habits: HabitRow[]) {
  const existingNames = new Set(habits.map((h) => h.name));
  const toCreate = Object.values(NUTRITION_HABIT_NAMES).filter((n) => !existingNames.has(n));
  if (toCreate.length === 0) return;

  const maxSort = habits.reduce((m, h) => Math.max(m, h.sort ?? 0), 0);
  const payload = toCreate.map((name, i) => ({
    name,
    type: "count" as const,
    target_daily: null,
    year_goal: null,
    sort: maxSort + (i + 1),
    enabled: false
  }));

  const { error } = await supabase.from("habits").insert(payload);
  if (error) throw error;
}

/* =========================
   Entries / Notes
   ========================= */

export async function getEntriesByRange(startISO: string, endISO: string) {
  const { data, error } = await supabase.from("entries").select("*").gte("date", startISO).lte("date", endISO);
  if (error) throw error;
  return (data ?? []) as EntryRow[];
}

export async function getEntriesForDate(dateISO: string) {
  const { data, error } = await supabase.from("entries").select("*").eq("date", dateISO);
  if (error) throw error;
  return (data ?? []) as EntryRow[];
}

export async function upsertEntries(entries: Array<Pick<EntryRow, "habit_id" | "date" | "value_num" | "value_bool">>) {
  const { error } = await supabase.from("entries").upsert(entries, { onConflict: "user_id,habit_id,date" });
  if (error) throw error;
}

export async function getDailyNote(dateISO: string) {
  const { data, error } = await supabase.from("daily_notes").select("*").eq("date", dateISO).maybeSingle();
  if (error) throw error;
  return (data ?? null) as DailyNoteRow | null;
}

export async function upsertDailyNote(note: { date: string; gratitude: string; improve: string }) {
  const { error } = await supabase.from("daily_notes").upsert(note, { onConflict: "user_id,date" });
  if (error) throw error;
}

export async function getDailyNotesByRange(startISO: string, endISO: string) {
  const { data, error } = await supabase
    .from("daily_notes")
    .select("*")
    .gte("date", startISO)
    .lte("date", endISO)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DailyNoteRow[];
}

/* =========================
   Profile / Leaderboard
   ========================= */

export async function getProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as ProfileRow | null;
}

export async function upsertProfile(userId: string, patch: { username?: string; public?: boolean }) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...patch }, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

export async function getMyScore(userId: string) {
  const { data, error } = await supabase.from("scores").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as ScoreRow | null;
}

export async function recalcMyScore() {
  // server-side calculation (prevents cheating)
  const { data, error } = await supabase.rpc("recalc_my_score");
  if (error) throw error;
  return data as ScoreRow;
}

export async function getLeaderboard(limit = 15) {
  const { data, error } = await supabase
    .from("leaderboard_public")
    .select("*")
    .order("xp", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Array<{ user_id: string; username: string; xp: number; level: number; rank: string; streak: number }>;
}

/* =========================
   Sleep
   ========================= */

export async function getSleepLog(dateISO: string) {
  const { data, error } = await supabase.from("sleep_logs").select("*").eq("date", dateISO).maybeSingle();
  if (error) throw error;
  return (data ?? null) as SleepLogRow | null;
}

export async function upsertSleepLog(dateISO: string, patch: Partial<SleepLogRow>) {
  const { data, error } = await supabase
    .from("sleep_logs")
    .upsert({ date: dateISO, ...patch }, { onConflict: "user_id,date" })
    .select("*")
    .single();
  if (error) throw error;
  return data as SleepLogRow;
}

/* =========================
   Template
   ========================= */

export async function applyTemplate() {
  const templates: Array<{ name: string; type: HabitType; target_daily: number | null; year_goal: number | null }> = [
    { name: "Workout", type: "toggle", target_daily: null, year_goal: 156 },
    { name: "Prayer", type: "toggle", target_daily: null, year_goal: 365 },
    { name: "Programming (2h)", type: "hours", target_daily: 2, year_goal: 730 },
    { name: "English (30m)", type: "minutes", target_daily: 30, year_goal: 180 },
    { name: "Screen before bed", type: "toggle", target_daily: null, year_goal: 300 },
    { name: "Screen after wake", type: "toggle", target_daily: null, year_goal: 300 },
    { name: "Service", type: "minutes", target_daily: 30, year_goal: 6000 },
    { name: "Sleep (hours)", type: "hours", target_daily: 8, year_goal: 2920 },
    { name: "Communication", type: "hours", target_daily: 1, year_goal: 365 }
  ];

  const existing = await getHabits();
  const names = new Set(existing.map((h) => h.name.trim().toLowerCase()));
  const maxSort = existing.reduce((m, h) => Math.max(m, h.sort ?? 0), 0);

  const toInsert = templates
    .filter((t) => !names.has(t.name.toLowerCase()))
    .map((t, i) => ({
      name: t.name,
      type: t.type,
      target_daily: t.target_daily,
      year_goal: t.year_goal,
      sort: maxSort + (i + 1),
      enabled: true
    }));

  if (toInsert.length === 0) return;

  const { error } = await supabase.from("habits").insert(toInsert);
  if (error) throw error;
}
