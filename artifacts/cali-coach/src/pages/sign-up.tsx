import { useState } from "react";
import { SignUp } from "@clerk/react";
import { Link } from "wouter";
import { Shield, CheckSquare, Square } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function SignUpPage() {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-8 gap-6">

      {/* Terms agreement gate — must check before Clerk widget is shown */}
      {!agreed ? (
        <div className="w-full max-w-[440px]">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 p-8 flex flex-col items-center gap-6">
            {/* Logo / icon */}
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>

            <div className="text-center">
              <h2 className="text-xl font-bold mb-1">Before you get started</h2>
              <p className="text-sm text-slate-400">
                Please confirm you have read and agree to our legal documents.
              </p>
            </div>

            {/* Checkbox */}
            <button
              type="button"
              onClick={() => setAgreed((v) => !v)}
              className="w-full flex items-start gap-3 p-4 rounded-xl border border-slate-600 bg-slate-800/60 hover:bg-slate-800 transition-colors text-left"
            >
              {agreed ? (
                <CheckSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              ) : (
                <Square className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
              )}
              <span className="text-sm text-slate-300 leading-relaxed">
                I confirm that I am physically fit to exercise and have read and agree
                to CaliCoach's{" "}
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
                </Link>.
              </span>
            </button>

            {/* CTA */}
            <button
              type="button"
              disabled={!agreed}
              onClick={() => setAgreed(true)}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all
                bg-primary text-white hover:bg-primary/90
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue to Sign Up
            </button>

            <p className="text-xs text-slate-500 text-center">
              Already have an account?{" "}
              <Link href="/sign-in" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      ) : (
        /* Clerk sign-up widget shown once agreed */
        <SignUp
          routing="path"
          path={`${basePath}/sign-up`}
          signInUrl={`${basePath}/sign-in`}
        />
      )}
    </div>
  );
}
