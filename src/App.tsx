import { useEffect, useMemo, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import AuthPage from "./pages/AuthPage";
import HabitsPage from "./pages/HabitsPage";
import ProfilePage from "./pages/ProfilePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ReflectionPage from "./pages/ReflectionPage";
import SettingsPage from "./pages/SettingsPage";
import DashboardPage from "./pages/DashboardPage";
import AppShell from "./components/AppShell";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const authed = useMemo(() => !!session?.user, [session]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="glass rounded-3xl px-6 py-5">
          <div className="text-sm text-slate-200">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/auth" element={authed ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
        <Route
          path="/"
          element={authed ? <Navigate to="/habits" replace /> : <Navigate to="/auth" replace />}
        />
        <Route
          path="/"
          element={authed ? <AppShell /> : <Navigate to="/auth" replace />}
        >
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="habits" element={<HabitsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="reflection" element={<ReflectionPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to={authed ? "/habits" : "/auth"} replace />} />
      </Routes>
    </HashRouter>
  );
}
