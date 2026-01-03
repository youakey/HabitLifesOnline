export type HabitType = "toggle" | "minutes" | "hours" | "count";

export type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  type: HabitType;
  target_daily: number | null;
  year_goal: number | null;
  sort: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type EntryRow = {
  id: string;
  user_id: string;
  habit_id: string;
  date: string; // YYYY-MM-DD
  value_num: number | null;
  value_bool: boolean | null;
  created_at: string;
  updated_at: string;
};

export type DailyNoteRow = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  gratitude: string;
  improve: string;
  created_at: string;
  updated_at: string;
};

export type SettingsRow = {
  id: string;
  user_id: string;
  nutrition_enabled: boolean;
  sleep_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string; // same as auth.users.id
  username: string;
  public: boolean;
  created_at: string;
  updated_at: string;
};

export type ScoreRow = {
  user_id: string;
  xp: number;
  level: number;
  rank: string;
  streak: number;
  best_streak: number;
  updated_at: string;
};

export type SleepLogRow = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD (wake date)
  bed_time: string | null;  // HH:MM
  wake_time: string | null; // HH:MM
  sleep_hours: number | null;
  screen_before_bed: boolean | null;
  screen_after_wake: boolean | null;
  created_at: string;
  updated_at: string;
};

export type NutritionKeys = "calories" | "protein" | "fat" | "carbs";

export const NUTRITION_HABIT_NAMES: Record<NutritionKeys, string> = {
  calories: "Nutrition • Calories",
  protein: "Nutrition • Protein",
  fat: "Nutrition • Fat",
  carbs: "Nutrition • Carbs"
};
