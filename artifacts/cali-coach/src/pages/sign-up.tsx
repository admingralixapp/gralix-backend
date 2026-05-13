import { useState } from "react";
import { SignUp } from "@clerk/react";
import { Link } from "wouter";
import { CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SignUpPage() {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-8 gap-4">

      {/* ── T&C checkbox — always visible, above the form ─────────────────── */}
      <div className="w-full max-w-[440px]">
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
            I confirm that I am physically fit to exercise and have read and
            agree to CaliCoach's{" "}
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

        {!agreed && (
          <p className="mt-2 text-center text-xs text-slate-500">
            Tick the box above to enable sign-up
          </p>
        )}
      </div>

      {/* ── Clerk sign-up widget — blocked until agreed ────────────────────── */}
      {/*
        pointer-events-none + reduced opacity tell the user the widget is
        inactive. The invisible overlay div prevents any accidental clicks
        from reaching the Clerk form before agreement is given.
        Once agreed === true the overlay is removed and Clerk takes over
        completely — the user fills email/password and clicks Sign Up themselves.
      */}
      <div
        className={cn(
          "relative w-full max-w-[440px] transition-opacity duration-200",
          !agreed && "opacity-35 pointer-events-none select-none",
        )}
      >
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
        />

        {/* Invisible click-blocker rendered on top when not yet agreed */}
        {!agreed && (
          <div
            aria-hidden
            className="absolute inset-0 z-10 cursor-not-allowed rounded-2xl"
          />
        )}
      </div>
    </div>
  );
}
