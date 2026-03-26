import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import logoSrc from "@assets/WhatsApp_Image_2026-02-25_at_11.51.01_AM_1774520807664.jpeg";

type Tab = "login" | "signup";
type View = "auth" | "forgot" | "reset-success";

interface AuthForm {
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  confirm?: string;
}

async function apiPost(path: string, body: object) {
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

function ForgotPasswordView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<"email" | "newpw" | "done">("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const verifyEmail = useMutation({
    mutationFn: async () => {
      const trimmed = email.toLowerCase().trim();
      if (!trimmed) throw new Error("Please enter your email address");
      if (!isValidEmail(trimmed)) throw new Error("Please enter a valid email address");
      const res = await fetch(`/api/users/check-email?email=${encodeURIComponent(trimmed)}`, { credentials: "include" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "No account found");
      return d;
    },
    onSuccess: () => { setEmailError(""); setStep("newpw"); },
    onError: (err: Error) => setEmailError(err.message),
  });

  const resetPassword = useMutation({
    mutationFn: () => {
      if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
      if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
      return apiPost("/api/auth/reset-password", { email: email.toLowerCase().trim(), newPassword });
    },
    onSuccess: () => setStep("done"),
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  if (step === "done") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm text-center"
      >
        <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Password Reset!</h2>
        <p className="text-zinc-400 text-sm mb-8">Your password has been updated successfully. You can now sign in with your new password.</p>
        <button
          onClick={onBack}
          data-testid="button-back-to-login"
          className="w-full h-12 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(135deg, #ef4444, #f97316)", boxShadow: "0 0 24px rgba(239,68,68,0.4)" }}
        >
          Back to Sign In
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      className="w-full max-w-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} data-testid="button-back-forgot" className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div>
          <h2 className="text-xl font-black text-white">Reset Password</h2>
          <p className="text-xs text-zinc-500">{step === "email" ? "Enter your account email" : "Choose your new password"}</p>
        </div>
      </div>

      {/* Icon */}
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(249,115,22,0.15))", border: "1px solid rgba(239,68,68,0.3)" }}>
          <KeyRound className="w-8 h-8 text-red-400" />
        </div>
      </div>

      {/* Step progress */}
      <div className="flex gap-2 mb-6">
        {["Find Account", "New Password"].map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1 rounded-full mb-1 transition-all duration-300 ${
              i === 0 ? "bg-red-500" : step === "newpw" ? "bg-red-500" : "bg-zinc-800"
            }`} />
            <p className={`text-[9px] font-semibold uppercase tracking-wider ${
              i === 0 || step === "newpw" ? "text-red-400" : "text-zinc-600"
            }`}>{label}</p>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === "email" ? (
          <motion.div key="email-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                Account Email
              </label>
              <input
                type="text"
                inputMode="email"
                data-testid="input-reset-email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                placeholder="you@example.com"
                autoComplete="email"
                onKeyDown={(e) => { if (e.key === "Enter") verifyEmail.mutate(); }}
                className={`w-full h-11 px-3.5 rounded-xl bg-zinc-900 border text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-colors ${
                  emailError ? "border-red-500 focus:border-red-500" : "border-zinc-700 focus:border-red-500"
                }`}
              />
              {emailError ? (
                <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                  <span className="text-red-400 text-base leading-none mt-0.5">⚠</span>
                  <div>
                    <p className="text-[12px] text-red-400 font-semibold">{emailError}</p>
                    {emailError.toLowerCase().includes("no account") && (
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Use the exact email you registered with, or{" "}
                        <button type="button" onClick={onBack} className="text-red-400 underline">create a new account</button>.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-600 mt-2">Enter the email address you used to register.</p>
              )}
            </div>
            <button
              onClick={() => verifyEmail.mutate()}
              disabled={!email.trim() || verifyEmail.isPending}
              data-testid="button-verify-email"
              className="w-full h-12 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #ef4444, #f97316)", boxShadow: "0 0 24px rgba(239,68,68,0.4)" }}
            >
              {verifyEmail.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
            </button>
          </motion.div>
        ) : (
          <motion.div key="newpw-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 mb-2">
              <p className="text-[11px] text-zinc-500">Resetting password for</p>
              <p className="text-sm font-bold text-white truncate">{email}</p>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">New Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  data-testid="input-new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  className="w-full h-11 px-3.5 pr-11 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                />
                <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                      newPassword.length >= i * 3
                        ? i <= 1 ? "bg-red-500" : i <= 2 ? "bg-orange-400" : i <= 3 ? "bg-yellow-400" : "bg-green-400"
                        : "bg-zinc-800"
                    }`} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  data-testid="input-confirm-new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                  className={`w-full h-11 px-3.5 pr-11 rounded-xl bg-zinc-900 border text-white text-sm placeholder:text-zinc-600 focus:outline-none transition-colors ${
                    confirmPassword && confirmPassword !== newPassword
                      ? "border-red-500/60 focus:border-red-500"
                      : confirmPassword && confirmPassword === newPassword
                        ? "border-green-500/60 focus:border-green-500"
                        : "border-zinc-700 focus:border-red-500"
                  }`}
                />
                <button type="button" onClick={() => setShowConfirm(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-[11px] text-red-400 mt-1">Passwords do not match</p>
              )}
              {confirmPassword && confirmPassword === newPassword && (
                <p className="text-[11px] text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Passwords match
                </p>
              )}
            </div>

            <button
              onClick={() => resetPassword.mutate()}
              disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || resetPassword.isPending}
              data-testid="button-reset-password"
              className="w-full h-12 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              style={{ background: "linear-gradient(135deg, #ef4444, #f97316)", boxShadow: "0 0 24px rgba(239,68,68,0.4)" }}
            >
              {resetPassword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}
            </button>

            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400 transition-colors mt-1"
            >
              Use a different email
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Login() {
  const [tab, setTab] = useState<Tab>("login");
  const [view, setView] = useState<View>("auth");
  const [form, setForm] = useState<AuthForm>({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (data: AuthForm) => {
      if (tab === "login") {
        return apiPost("/api/auth/login", { email: data.email, password: data.password });
      } else {
        if (data.password !== data.confirm) throw new Error("Passwords do not match");
        return apiPost("/api/auth/register", {
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

      <AnimatePresence mode="wait">
        {view === "forgot" ? (
          <motion.div key="forgot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex flex-col items-center">
            <ForgotPasswordView onBack={() => setView("auth")} />
          </motion.div>
        ) : (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex flex-col items-center">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center mb-10"
            >
              <div className="relative w-20 h-20 mb-4">
                <div className="absolute inset-0 rounded-[22px] rotate-6 opacity-60"
                  style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }} />
                <img
                  src={logoSrc}
                  alt="VID-X"
                  className="relative w-full h-full rounded-[18px] object-cover shadow-2xl"
                  style={{ boxShadow: "0 0 30px rgba(239,68,68,0.35)" }}
                />
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
                        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">First Name</label>
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
                        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Last Name</label>
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
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Email</label>
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Password</label>
                    {tab === "login" && (
                      <button
                        type="button"
                        data-testid="button-forgot-password"
                        onClick={() => setView("forgot")}
                        className="text-[11px] text-red-400 font-semibold hover:text-red-300 transition-colors"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
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
                      <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Confirm Password</label>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
