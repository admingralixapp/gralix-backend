import { Link } from "wouter";
import { Activity, Users, Lock } from "lucide-react";
import { TOTAL_SKILL_COUNT } from "@/lib/skill-tree";

export function Landing() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">CaliCoach</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            Master your movement,<br />
            <span className="text-primary">share your journey.</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
            Real-time form analysis, skill tree progression, and now — train alongside
            friends and see how your progress stacks up.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sign-up"
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
            >
              Start Training Free
            </Link>
            <Link
              href="/sign-in"
              className="px-6 py-3 rounded-lg border border-border font-semibold hover:bg-secondary transition-colors"
            >
              Sign In
            </Link>
          </div>

          {/* Legal micro-links */}
          <p className="mt-4 text-xs text-muted-foreground">
            By signing up you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Privacy Policy
            </Link>.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 max-w-3xl w-full">
          {[
            {
              icon: Activity,
              title: "Skill Tree",
              desc: `Unlock ${TOTAL_SKILL_COUNT} skills across 4 progressive branches — including static holds and explosive moves.`,
            },
            {
              icon: Users,
              title: "Friends",
              desc: "Send requests, view friends' skill trees, and celebrate their milestones.",
            },
            {
              icon: Lock,
              title: "Privacy Controls",
              desc: "Choose Public, Friends Only, or Private for your profile at any time.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 text-left">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
