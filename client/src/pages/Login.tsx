import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Play, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

type Tab = "login" | "signup";

interface AuthForm {
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  confirm?: string;
}

async function apiAuth(path: string, body: object) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Something went wrong");
  return data;
}

export default function Login() {
  const [tab, setTab] = useState<Tab>("login");
  const [form, setForm] = useState<AuthForm>({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (data: AuthForm) => {
      if (tab === "login") {
        return apiAuth("/api/auth/login", { email: data.email, password: data.password });
      } else {
        if (data.password !== data.confirm) throw new Error("Passwords do not match");
        return apiAuth("/api/auth/register", {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
        });
      }
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/user"], user);
      navigate("/");
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const update = (field: keyof AuthForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-5 relative overflow-hidden">
      {/* Background glow blobs */}
      <div className="absolute top-[-120px] left-[-80px] w-[340px] h-[340px] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #ef4444, transparent)" }} />
      <div className="absolute bottom-[-100px] right-[-60px] w-[280px] h-[280px] rounded-full opacity-15 blur-3xl"
        style={{ background: "radial-gradient(circle, #f97316, transparent)" }} />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center mb-10"
      >
        <div className="relative w-20 h-20 mb-4">
          <div className="absolute inset-0 rounded-2xl rotate-6"
            style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }} />
          <div className="relative w-full h-full rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #dc2626, #ea580c)" }}>
            <Play className="w-9 h-9 text-white fill-white ml-1" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">VID-X</h1>
        <p className="text-zinc-500 text-sm mt-1">The next generation social platform</p>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-sm"
      >
        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden mb-6 border border-zinc-800 bg-zinc-900/60">
          {(["login", "signup"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setForm({ email: "", password: "" }); }}
              className="flex-1 py-3 text-sm font-bold transition-all"
              style={{
                background: tab === t ? "linear-gradient(135deg, #ef4444, #f97316)" : "transparent",
                color: tab === t ? "white" : "#71717a",
              }}
            >
              {t === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {tab === "signup" && (
              <motion.div
                key="name-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-3 overflow-hidden"
              >
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                    First Name
                  </label>
                  <input
                    required
                    data-testid="input-first-name"
                    value={form.firstName ?? ""}
                    onChange={(e) => update("firstName", e.target.value)}
                    placeholder="Alice"
                    className="w-full h-11 px-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                    Last Name
                  </label>
                  <input
                    required
                    data-testid="input-last-name"
                    value={form.lastName ?? ""}
                    onChange={(e) => update("lastName", e.target.value)}
                    placeholder="Wonder"
                    className="w-full h-11 px-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              required
              data-testid="input-email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full h-11 px-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                required
                data-testid="input-password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="••••••••"
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                className="w-full h-11 px-3.5 pr-11 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {tab === "signup" && (
              <motion.div
                key="confirm-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    data-testid="input-confirm-password"
                    value={form.confirm ?? ""}
                    onChange={(e) => update("confirm", e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full h-11 px-3.5 pr-11 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            data-testid="button-submit"
            disabled={mutation.isPending}
            className="w-full h-12 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            style={{
              background: "linear-gradient(135deg, #ef4444, #f97316)",
              boxShadow: "0 0 24px rgba(239,68,68,0.4)",
            }}
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : tab === "login" ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Switch tab hint */}
        <p className="text-center text-zinc-600 text-xs mt-5">
          {tab === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => { setTab(tab === "login" ? "signup" : "login"); setForm({ email: "", password: "" }); }}
            className="text-red-400 font-semibold hover:text-red-300 transition-colors"
          >
            {tab === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
