import { SignIn, useClerk } from "@clerk/react";
import { Activity, Loader2 } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Skeleton card that mirrors the approximate shape of the Clerk SignIn widget */
function SignInSkeleton() {
  return (
    <div className="w-full max-w-[400px] rounded-2xl border border-border bg-card p-8 shadow-xl flex flex-col items-center gap-5">
      {/* Brand mark */}
      <div className="flex flex-col items-center gap-2 mb-1">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
          <Activity className="w-6 h-6 text-primary-foreground" />
        </div>
        <div className="h-5 w-28 rounded bg-muted animate-pulse" />
        <div className="h-3.5 w-36 rounded bg-muted/60 animate-pulse mt-0.5" />
      </div>

      {/* Input skeletons */}
      <div className="w-full space-y-3">
        <div className="space-y-1.5">
          <div className="h-3 w-20 rounded bg-muted animate-pulse" />
          <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-16 rounded bg-muted animate-pulse" />
          <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
        </div>
      </div>

      {/* CTA skeleton */}
      <div className="h-10 w-full rounded-md bg-primary/40 animate-pulse" />

      {/* Spinner */}
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mt-1" />
    </div>
  );
}

export function SignInPage() {
  const { loaded } = useClerk();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      {loaded ? (
        <SignIn
          routing="path"
          path={`${basePath}/sign-in`}
          signUpUrl={`${basePath}/sign-up`}
        />
      ) : (
        <SignInSkeleton />
      )}
    </div>
  );
}
