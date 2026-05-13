import { useState } from "react";
import { useClerk } from "@clerk/react";
import { Link, useLocation } from "wouter";
import {
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  Check,
  X,
  Mail,
  Lock,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Password rules ────────────────────────────────────────────────────────────

const PASSWORD_RULES = [
  {
    id: "len",
    label: "8–32 characters",
    test: (p: string) => p.length >= 8 && p.length <= 32,
  },
  {
    id: "upper",
    label: "One uppercase letter (A–Z)",
    test: (p: string) => /[A-Z]/.test(p),
  },
  {
    id: "lower",
    label: "One lowercase letter (a–z)",
    test: (p: string) => /[a-z]/.test(p),
  },
  {
    id: "number",
    label: "One number (0–9)",
    test: (p: string) => /[0-9]/.test(p),
  },
  {
    id: "special",
    label: "One special character (!@#$%^&*…)",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
] as const;

function isPasswordValid(p: string) {
  return PASSWORD_RULES.every((r) => r.test(p));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PasswordChecklist({ password }: { password: string }) {
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1 px-1">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <div
            key={rule.id}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors duration-150",
              ok ? "text-green-400" : "text-slate-500",
            )}
          >
            {ok ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{rule.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-px bg-slate-700" />
      <span className="text-xs text-slate-500 font-medium">or</span>
      <div className="flex-1 h-px bg-slate-700" />
    </div>
  );
}

// ── Shared field style ────────────────────────────────────────────────────────

const inputClass =
  "w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition";

// ── Clerk error helper ────────────────────────────────────────────────────────

function clerkMsg(err: unknown): string {
  const e = err as { errors?: { message?: string; longMessage?: string }[] };
  return (
    e?.errors?.[0]?.longMessage ??
    e?.errors?.[0]?.message ??
    "Something went wrong. Please try again."
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Step = "credentials" | "verify";

export function SignUpPage() {
  const clerk = useClerk();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<Step>("credentials");

  // Credentials step
  const [agreed,       setAgreed]       = useState(false);
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitError,  setSubmitError]  = useState("");

  // Verify step
  const [code,      setCode]      = useState("");
  const [codeError, setCodeError] = useState("");

  const [loading, setLoading] = useState(false);

  const pwdValid  = isPasswordValid(password);
  const canCreate = agreed && email.trim().length > 0 && pwdValid && !loading;

  // Convenience ref to the Clerk SignUpResource (imperative API)
  function getSignUp() {
    return clerk.client?.signUp;
  }

  // ── Step 1: create account ─────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const signUp = getSignUp();
    if (!signUp || !canCreate) return;

    setLoading(true);
    setSubmitError("");
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err) {
      setSubmitError(clerkMsg(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Google OAuth ───────────────────────────────────────────────────────────
  async function handleGoogle() {
    const signUp = getSignUp();
    if (!signUp) return;
    const origin = window.location.origin;
    const base   = import.meta.env.BASE_URL.replace(/\/$/, "");
    try {
      await signUp.authenticateWithRedirect({
        strategy:            "oauth_google",
        redirectUrl:         `${origin}${base}/sso-callback`,
        redirectUrlComplete: `${origin}${base}/`,
      });
    } catch (err) {
      setSubmitError(clerkMsg(err));
    }
  }

  // ── Step 2: verify OTP ─────────────────────────────────────────────────────
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const signUp = getSignUp();
    if (!signUp || loading) return;

    setLoading(true);
    setCodeError("");
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
        setLocation("/");
      }
    } catch (err) {
      setCodeError(clerkMsg(err));
    } finally {
      setLoading(false);
    }
  }

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  async function handleResend() {
    const signUp = getSignUp();
    if (!signUp) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch { /* silent */ }
  }

  // ── Render: OTP verification ───────────────────────────────────────────────
  if (step === "verify") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-[440px] bg-slate-900 rounded-2xl border border-slate-700 p-8 flex flex-col gap-6">
          <button
            type="button"
            onClick={() => setStep("credentials")}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-1">Check your email</h2>
            <p className="text-sm text-slate-400">
              We sent a 6-digit code to{" "}
              <span className="text-white font-medium">{email}</span>
            </p>
          </div>

          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
                Verification Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={cn(inputClass, "text-center text-xl tracking-widest")}
                autoFocus
              />
              {codeError && (
                <p className="mt-1.5 text-xs text-red-400">{codeError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={code.length < 6 || loading}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify &amp; Continue
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center">
            Didn't receive it?{" "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={handleResend}
            >
              Resend code
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ── Render: credentials ────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-[440px] bg-slate-900 rounded-2xl border border-slate-700 p-8 flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-xl font-bold mb-1">Create your account</h2>
          <p className="text-sm text-slate-400">Start your calisthenics journey</p>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 transition text-sm font-medium text-white"
        >
          {/* Google 'G' logo */}
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <Divider />

        {/* Email / Password form */}
        <form onSubmit={handleCreate} className="flex flex-col gap-4" noValidate>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
              Email address
            </label>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setSubmitError(""); }}
                className={cn(inputClass, "pr-11")}
                required
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Real-time password checklist */}
            <PasswordChecklist password={password} />
          </div>

          {/* T&C checkbox */}
          <button
            type="button"
            onClick={() => setAgreed((v) => !v)}
            className={cn(
              "w-full flex items-start gap-3 p-4 rounded-xl border transition-colors text-left",
              agreed
                ? "border-primary/50 bg-primary/5 hover:bg-primary/8"
                : "border-slate-600 bg-slate-800/60 hover:bg-slate-800",
            )}
          >
            {agreed ? (
              <CheckSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            ) : (
              <Square className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
            )}
            <span className="text-sm text-slate-300 leading-relaxed">
              I confirm I am physically fit to exercise and agree to CaliCoach's{" "}
              <Link
                href="/terms"
                onClick={(e) => e.stopPropagation()}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Terms &amp; Conditions
              </Link>{" "}
              (including the Physical Activity Readiness declaration and Liability
              Waiver) and the{" "}
              <Link
                href="/privacy"
                onClick={(e) => e.stopPropagation()}
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </button>

          {/* Submit error */}
          {submitError && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}

          {/* Submit — disabled until all requirements met */}
          <button
            type="submit"
            disabled={!canCreate}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Account
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
