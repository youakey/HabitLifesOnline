import { useEffect, useMemo, useState } from "react";
import Page from "../components/Page";
import Card from "../components/Card";
import Skeleton from "../components/Skeleton";
import { Calendar, Search } from "lucide-react";
import { getDailyNote, getDailyNotesByRange, getSession, upsertDailyNote } from "../lib/db";
import { toISODate } from "../lib/date";
import { addDays, format } from "date-fns";
import { useToast } from "../components/Toast";

type Note = { date: string; gratitude: string; improve: string };

export default function ReflectionPage() {
  const toast = useToast();
  const [selected, setSelected] = useState(toISODate(new Date()));
  const [list, setList] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<{ gratitude: string; improve: string }>({ gratitude: "", improve: "" });
  const [saving, setSaving] = useState(false);

  async function loadList() {
    setLoading(true);
    try {
      const end = toISODate(new Date());
      const start = toISODate(addDays(new Date(), -180));
      const rows = await getDailyNotesByRange(start, end);
      setList(rows.map(r => ({ date: r.date, gratitude: r.gratitude ?? "", improve: r.improve ?? "" })));
    } finally {
      setLoading(false);
    }
  }

  async function loadSelected() {
    const dn = await getDailyNote(selected);
    setEdit({ gratitude: dn?.gratitude ?? "", improve: dn?.improve ?? "" });
  }

  useEffect(() => { loadList(); }, []);
  useEffect(() => { loadSelected(); }, [selected]);

  const filtered = useMemo(() => {
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter(n => (n.gratitude + " " + n.improve).toLowerCase().includes(s) || n.date.includes(s));
  }, [list, q]);

  async function save() {
    setSaving(true);
    try {
      const { data } = await getSession();
      const userId = data.session?.user.id;
      if (!userId) return;
      await upsertDailyNote({ date: selected, gratitude: edit.gratitude, improve: edit.improve });
      toast.push({ kind: "success", title: "Saved", detail: "Reflection saved" });
      await loadList();
    } catch (e: any) {
      toast.push({ kind: "error", title: "Save error", detail: e?.message ?? "Unknown error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 space-y-6">
          <Card title="Daily reflection" subtitle="Browse and search your notes">
            <div className="space-y-3">
              <div>
                <div className="label mb-1">Date</div>
                <div className="relative">
                  <Calendar className="h-4 w-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input className="input pl-9" type="date" value={selected} onChange={(e) => setSelected(e.target.value)} />
                </div>
              </div>

              <div>
                <div className="label mb-1">Search</div>
                <div className="relative">
                  <Search className="h-4 w-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search text or date…" />
                </div>
              </div>

              <button className="btn btn-ghost w-full" onClick={loadList} type="button">Refresh list</button>
            </div>
          </Card>

          <Card title="History" subtitle="Latest notes">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[55vh] overflow-auto pr-1">
                {filtered.map((n) => (
                  <button
                    key={n.date}
                    onClick={() => setSelected(n.date)}
                    className={"w-full text-left glass-subtle rounded-2xl p-3 border transition " + (n.date === selected ? "border-white/20 bg-white/15" : "border-white/10 hover:bg-white/10")}
                    type="button"
                  >
                    <div className="text-sm font-medium">{format(new Date(n.date), "MMM d, yyyy")}</div>
                    <div className="text-xs text-slate-500 truncate">{(n.gratitude || n.improve || "—").slice(0, 80)}</div>
                  </button>
                ))}
                {!filtered.length ? <div className="text-sm text-slate-400">No notes yet.</div> : null}
              </div>
            )}
          </Card>
        </div>

        <div className="xl:col-span-8 space-y-6">
          <Card
            title={format(new Date(selected), "MMM d, yyyy")}
            subtitle="Write, refine, and look back"
            right={<button className="btn btn-primary" onClick={save} disabled={saving} type="button">{saving ? "Saving…" : "Save"}</button>}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="label mb-1">Gratitude</div>
                <textarea
                  className="textarea h-64"
                  value={edit.gratitude}
                  onChange={(e) => setEdit((p) => ({ ...p, gratitude: e.target.value }))}
                  placeholder="3 things I’m grateful for today…"
                />
                <div className="text-[11px] text-slate-500 mt-1">{edit.gratitude.length} chars</div>
              </div>
              <div>
                <div className="label mb-1">Improve</div>
                <textarea
                  className="textarea h-64"
                  value={edit.improve}
                  onChange={(e) => setEdit((p) => ({ ...p, improve: e.target.value }))}
                  placeholder="If I could relive this day, I would…"
                />
                <div className="text-[11px] text-slate-500 mt-1">{edit.improve.length} chars</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
