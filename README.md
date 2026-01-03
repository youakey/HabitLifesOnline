# HabitLife (Premium v4)

Habit + goals tracker with:
- Daily Habits (toggle / minutes / hours / count)
- Daily reflection + history
- Analytics
- **XP + Levels + Rank + Leaderboard (by XP)**
- **Streak (server-calculated, anti-backfill)**
- Modules: Nutrition, Sleep
- PWA + Supabase sync + GitHub Pages deploy

## 1) Supabase setup (must do once)

1. Create a Supabase project.
2. Go to **SQL Editor → New query**.
3. Paste and run **`supabase.sql`** from this repo.
4. Go to **Authentication → Providers** and enable **Email**.

## 2) Local run

Install:

```bash
npm i
```

Create `.env.local`:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
# for GitHub Pages you will set BASE_PATH in Actions, locally it can be empty:
VITE_BASE_PATH=
```

Run:

```bash
npm run dev
```

## 3) Deploy to GitHub Pages

1. Create repo on GitHub (for example: `habitlife`).
2. Push this project to the repo.
3. In GitHub repo → **Settings → Pages**:
   - Source: **GitHub Actions**
4. In GitHub repo → **Settings → Secrets and variables → Actions**:
   - Add secrets:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
   - Add variable:
     - `BASE_PATH` = `/REPO_NAME/` (example: `/habitlife/`)
5. Go to **Actions** tab → wait for workflow **Deploy** to finish.

Done: open `https://YOUR_USERNAME.github.io/REPO_NAME/`.

## Notes

- Username is required for leaderboard; change it in **Settings → Account**.
- Streak and XP are calculated on the server (RPC `recalc_my_score()`).
