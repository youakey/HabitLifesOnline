import Page from "../components/Page";
import Card from "../components/Card";
import AnalyticsBlock from "../sections/AnalyticsBlock";
import { useEffect, useState } from "react";
import type { HabitRow } from "../lib/types";
import { ensureSettingsRow, getHabits, getSession, getSettings } from "../lib/db";
import { toISODate } from "../lib/date";

export default function AnalyticsPage() {
  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [nutritionEnabled, setNutritionEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await getSession();
      const userId = data.session?.user.id;
      if (!userId) return;
      await ensureSettingsRow(userId);
      const [hs, st] = await Promise.all([getHabits(), getSettings(userId)]);
      setHabits(hs);
      setNutritionEnabled(Boolean(st?.nutrition_enabled));
    })();
  }, []);

  return (
    <Page>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 space-y-6">
          <Card title="Analytics" subtitle="Trends, completion, goals — 365d stays readable">
            <div className="text-sm text-slate-300">
              Choose a habit and period. For 365d use Weekly/Monthly aggregation.
            </div>
          </Card>
          <AnalyticsBlock dateISO={toISODate(new Date())} habits={habits} nutritionEnabled={nutritionEnabled} />
        </div>
        <div className="xl:col-span-5 space-y-6">
          <Card title="How to read 365d" subtitle="No squeezed charts">
            <div className="text-sm text-slate-300 space-y-2">
              <div>• Weekly = 52 points (great for habits).</div>
              <div>• Monthly = 12 points (great for big picture).</div>
              <div>• Toggle habits show completion %.</div>
            </div>
          </Card>
          <Card title="Year goals" subtitle="Keep it realistic">
            <div className="text-sm text-slate-300">
              Year goals progress is shown as progress bars. Add goals in Settings → Habits.
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
