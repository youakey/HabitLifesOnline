import { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import Page from "../components/Page";
import { motion } from "framer-motion";
import { Sparkles, Mail, Lock, User, CheckCircle2, RefreshCw } from "lucide-react";

type Mode = "signin" | "signup";

function Field({
  label,
  type,
  value,
  setValue,
  icon: Icon,
  placeholder,
  autoComplete
}: {
  label: string;
  type: string;
  value: string;
  setValue: (v: string) => void;
  icon: any;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <div className="label mb-1">{label}</div>
      <div className="relative">
        <Icon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          className="input pl-9"
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          autoComplete={autoComplete}
          spellCheck={false}
        />
      </div>
    </label>
  );
}

function normalizeUsername(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
}

function safeErrorMessage(err: any) {
  const msg = String(err?.message ?? "");
  // Не показываем “технические” сообщения полностью (меньше инфы для атак)
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.toLowerCase().includes("invalid login")) return "Invalid email or password.";
  if (msg.toLowerCase().includes("email rate limit")) return "Too many attempts. Please try again later.";
  return msg.length > 140 ? "Something went wrong. Please try again." : msg;
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [signupDone, setSignupDone] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendOk, setResendOk] = useState(false);

  const baseUrl = useMemo(() => {
    // Vite задаёт BASE_URL с учётом base path (для GitHub Pages это /repo/)
    // Это важно для корректных ссылок подтверждения.
    return `${window.location.origin}${import.meta.env.BASE_URL}`;
  }, []);

  const cleanUsername = useMemo(() => normalizeUsername(username), [username]);

  async function ensureProfile(userId: string, fallbackUsername: string) {
    // Важно: это работает ТОЛЬКО если в Supabase настроены RLS-политики:
    // profiles: insert/update where auth.uid() = id
    const { error: e } = await supabase.from("profiles").upsert(
      {
        id: userId,
        username: fallbackUsername,
        public: true
      },
      { onConflict: "id" }
    );
    if (e) {
      // Не валим логин из-за профиля — просто тихо логируем
      console.warn("Profile upsert failed:", e.message);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setResendOk(false);

    try {
      if (!email || !password) {
        setError("Please fill in email and password.");
        return;
      }

      if (mode === "signup") {
        if (!cleanUsername || cleanUsername.length < 3) {
          setError("Username must be at least 3 characters.");
          return;
        }
        if (password.length < 8) {
          setError("Password must be at least 8 characters.");
          return;
        }

        const { data, error: e } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: baseUrl,
            data: { username: cleanUsername }
          }
        });

        if (e) throw e;

        const needsEmailConfirm = !!data.user && !data.user.email_confirmed_at;

        if (needsEmailConfirm) {
          setSignupDone(true);
        } else {
          // Если confirmations выключены — пользователь может войти сразу.
          // На всякий случай пробуем создать профиль уже сейчас (если есть сессия).
          const sessionUser = data.user;
          if (sessionUser?.id) {
            await ensureProfile(sessionUser.id, cleanUsername);
          }
        }

        return;
      }

      // signin
      const { data, error: e } = await supabase.auth.signInWithPassword({ email, password });
      if (e) throw e;

      const user = data.user;
      const metaUsername = String((user as any)?.user_metadata?.username ?? "");
      const fallback = metaUsername || email.split("@")[0]?.slice(0, 20) || "user";
      await ensureProfile(user.id, normalizeUsername(fallback));
    } catch (e: any) {
      setError(safeErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!email) return;
    setResendBusy(true);
    setError(null);
    setResendOk(false);

    try {
      const { error: e } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: baseUrl }
      });
      if (e) throw e;
      setResendOk(true);
    } catch (e: any) {
      setError(safeErrorMessage(e));
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden grid place-items-center px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-28 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute top-24 -right-28 h-[28rem] w-[28rem] rounded-full bg-cyan-400/12 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-fuchsia-400/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:20px_20px]" />
      </div>

      <Page>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="glass rounded-3xl w-full max-w-md p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/10 grid place-items-center">
              <Sparkles className="h-5 w-5 text-indigo-200" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold">HabitLife</div>
              <div className="text-xs text-slate-300">Habits • Goals • Reflection</div>
            </div>
          </div>

          <div className="flex gap-2 mb-5">
            <button
              className={"btn flex-1 " + (mode === "signin" ? "btn-primary" : "")}
              onClick={() => {
                setMode("signin");
                setSignupDone(false);
                setError(null);
                setResendOk(false);
              }}
              type="button"
            >
              Sign in
            </button>
            <button
              className={"btn flex-1 " + (mode === "signup" ? "btn-primary" : "")}
              onClick={() => {
                setMode("signup");
                setSignupDone(false);
                setError(null);
                setResendOk(false);
              }}
              type="button"
            >
              Sign up
            </button>
          </div>

          {signupDone ? (
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 mb-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-200" />
                <div>
                  <div className="font-medium">Confirm your email</div>
                  <div className="text-emerald-100/90 mt-0.5">
                    We sent a confirmation link to <b>{email}</b>. Open it to activate your account.
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="btn"
                      onClick={resendConfirmation}
                      disabled={resendBusy}
                    >
                      <RefreshCw className={"h-4 w-4 " + (resendBusy ? "animate-spin" : "")} />
                      {resendBusy ? "Sending…" : "Resend email"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setMode("signin");
                        setSignupDone(false);
                        setError(null);
                      }}
                    >
                      Back to Sign in
                    </button>
                  </div>

                  {resendOk ? (
                    <div className="mt-2 text-xs text-emerald-200/90">Email sent again.</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {mode === "signup" ? (
              <Field
                label="Username"
                type="text"
                value={username}
                setValue={setUsername}
                icon={User}
                placeholder="yourname"
                autoComplete="username"
              />
            ) : null}

            <Field
              label="Email"
              type="email"
              value={email}
              setValue={setEmail}
              icon={Mail}
              placeholder="name@example.com"
              autoComplete={mode === "signup" ? "email" : "username"}
            />

            <Field
              label="Password"
              type="password"
              value={password}
              setValue={setPassword}
              icon={Lock}
              placeholder="••••••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />

            {mode === "signup" && username && cleanUsername !== username ? (
              <div className="text-xs text-slate-400">
                Username will be saved as <span className="chip">{cleanUsername}</span>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <button
              className="btn btn-primary w-full"
              onClick={submit}
              disabled={
                busy ||
                !email ||
                !password ||
                (mode === "signup" && (!cleanUsername || cleanUsername.length < 3))
              }
              type="button"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </div>

          <div className="mt-5 text-xs text-slate-400">
            {mode === "signup" ? "You can change your username later in Settings." : "Welcome back."}
          </div>
        </motion.div>
      </Page>
    </div>
  );
}
