import { useEffect, useMemo, useState } from "react";
import Page from "../components/Page";
import Card from "../components/Card";
import Skeleton from "../components/Skeleton";
import { Crown, Flame, Sparkles, Trophy, User2 } from "lucide-react";
import { getLeaderboard, getMyScore, getProfile, getSession, recalcMyScore } from "../lib/db";
import { useToast } from "../components/Toast";
import { cn } from "../lib/ui";

function RankBadge({ rank }: { rank: string }) {
  const cls =
    rank === "Diamond"
      ? "chip chip-good"
      : rank === "Gold"
      ? "chip chip-warn"
      : rank === "Silver"
      ? "chip"
      : "chip";
  return <span className={cls}>{rank}</span>;
}

export default function ProfilePage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [score, setScore] = useState<{ xp: number; level: number; rank: string; streak: number; best_streak: number } | null>(null);
  const [leaders, setLeaders] = useState<Array<{ user_id: string; username: string; xp: number; level: number; rank: string; streak: number }>>([]);

  async function load() {
    setLoading(true);
    try {
      const { data: s } = await getSession();
      const user = s.session?.user;
      if (!user) return;
      setEmail(user.email ?? "");

      // refresh server-side score (anti-cheat)
      try {
        await recalcMyScore();
      } catch {}

      const [prof, my, top] = await Promise.all([getProfile(user.id), getMyScore(user.id), getLeaderboard(15)]);
      setUsername(prof?.username ?? "");
      setScore(my ? { xp: my.xp, level: my.level, rank: my.rank, streak: my.streak, best_streak: my.best_streak } : null);
      setLeaders(top);
    } catch (e: any) {
      toast.push({ kind: "error", title: "Profile error", detail: e?.message ?? "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const xpToNext = useMemo(() => {
    if (!score) return null;
    // level formula in SQL: level = 1 + floor(sqrt(xp/80))
    const nextLevel = score.level + 1;
    const nextXP = (nextLevel - 1) * (nextLevel - 1) * 80;
    return Math.max(0, nextXP - score.xp);
  }, [score]);

  const meInTop = useMemo(() => {
    if (!email || !leaders.length) return null;
    // can't rely on email in leaderboard, only username. just show highlights if username matches.
    return leaders.find((x) => x.username === username) ?? null;
  }, [leaders, username, email]);

  return (
    <Page>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-6">
          <Card title="Profile" subtitle="Your progress, XP and streak">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="glass-subtle rounded-2xl p-4 md:col-span-2">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/10 grid place-items-center">
                      <User2 className="h-5 w-5 text-slate-200" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-semibold truncate">{username || "Anonymous"}</div>
                      <div className="text-xs text-slate-400 truncate">{email || "—"}</div>
                    </div>
                    {score ? <div className="ml-auto flex items-center gap-2"><RankBadge rank={score.rank} /></div> : null}
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="glass-subtle rounded-2xl p-3">
                      <div className="text-xs text-slate-400">Level</div>
                      <div className="text-2xl font-semibold mt-1">{score?.level ?? "—"}</div>
                      <div className="text-xs text-slate-500 mt-1">{xpToNext === null ? "" : `${xpToNext} XP to next`}</div>
                    </div>
                    <div className="glass-subtle rounded-2xl p-3">
                      <div className="text-xs text-slate-400">XP</div>
                      <div className="text-2xl font-semibold mt-1">{score?.xp ?? "—"}</div>
                      <div className="text-xs text-slate-500 mt-1">Earned by real activity</div>
                    </div>
                    <div className="glass-subtle rounded-2xl p-3">
                      <div className="text-xs text-slate-400">Streak</div>
                      <div className="text-2xl font-semibold mt-1 flex items-center gap-2">
                        <Flame className="h-5 w-5 text-amber-200" />
                        {score?.streak ?? "—"}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Best: {score?.best_streak ?? "—"}</div>
                    </div>
                  </div>
                </div>

                <div className="glass-subtle rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-200" />
                    <div className="text-sm font-semibold">How to gain XP</div>
                  </div>
                  <div className="mt-3 text-sm text-slate-300 space-y-2">
                    <div>• Complete toggle habits</div>
                    <div>• Log minutes / hours / counts</div>
                    <div>• Fill Daily reflection</div>
                    <div>• Track Sleep (if enabled)</div>
                  </div>
                  <div className="hint mt-3">
                    Streak is computed on the server using timestamps, so backfilling old days doesn’t boost it.
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card title="Rank system" subtitle="Simple, readable progression">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[
                { name: "Bronze", lvl: "1–4" },
                { name: "Silver", lvl: "5–9" },
                { name: "Gold", lvl: "10–17" },
                { name: "Diamond", lvl: "18+" }
              ].map((r) => (
                <div key={r.name} className="glass-subtle rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{r.name}</div>
                    <Trophy className="h-4 w-4 text-slate-300" />
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Level {r.lvl}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <Card title="Leaderboard" subtitle="Top users by XP">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : leaders.length ? (
              <div className="space-y-2">
                {leaders.map((u, idx) => {
                  const isMe = u.username === username && username !== "";
                  return (
                    <div
                      key={u.user_id}
                      className={cn(
                        "glass-subtle rounded-2xl p-3 flex items-center gap-3",
                        isMe ? "border-white/25 bg-white/10" : ""
                      )}
                    >
                      <div className="h-9 w-9 rounded-2xl bg-white/10 border border-white/10 grid place-items-center text-sm font-semibold">
                        {idx === 0 ? <Crown className="h-4 w-4 text-amber-200" /> : idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{u.username}</div>
                        <div className="text-xs text-slate-500">
                          Level {u.level} • <span className="text-slate-400">{u.rank}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{u.xp} XP</div>
                        <div className="text-xs text-slate-500">🔥 {u.streak}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-400">No public profiles yet.</div>
            )}
          </Card>

          <Card title="Privacy" subtitle="You control what is public">
            <div className="text-sm text-slate-300">
              Your email is never shown. Leaderboard uses your username only. You can disable public profile in Settings →
              Account.
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
