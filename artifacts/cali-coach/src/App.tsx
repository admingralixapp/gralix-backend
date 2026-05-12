import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { isRTL } from "@/i18n/languages";
import {
  ClerkProvider,
  SignIn,
  SignUp,
  Show,
  useClerk,
  useUser,
} from "@clerk/react";
import { purgeExpiredClips } from "@/lib/clip-store";
import { UploadManagerProvider } from "@/lib/upload-manager";
import { dark } from "@clerk/themes";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { Home } from "@/pages/home";
import { Workout } from "@/pages/workout";
import { History } from "@/pages/history";
import { SessionDetail } from "@/pages/session-detail";
import { Progress } from "@/pages/progress";
import { Exercises } from "@/pages/exercises";
import { CommunityFeedPage } from "@/pages/community-feed";
import { SkillTreePage } from "@/pages/skill-tree";
import { Friends } from "@/pages/friends";
import { ProfilePage } from "@/pages/profile";
import { Leaderboard } from "@/pages/leaderboard";
import { Settings } from "@/pages/settings";
import { ShopPage } from "@/pages/shop";
import { SignInPage } from "@/pages/sign-in";
import { SignUpPage } from "@/pages/sign-up";
import { Landing } from "@/pages/landing";
import { TermsPage } from "@/pages/terms";
import { PrivacyPage } from "@/pages/privacy";
import { MobilityPage } from "@/pages/mobility";
import { AnimLabPage } from "@/pages/anim-lab";
import { BodyCalibration } from "@/pages/body-calibration";
import { TrainingHub } from "@/pages/training-hub";
import { MasteryHub } from "@/pages/mastery-hub";
import { CommunityHub } from "@/pages/community-hub";
import NotFound from "@/pages/not-found";
import { useMyProfile, useUpsertProfile } from "@/lib/social";
import { setVoiceLanguage } from "@/lib/voice-service";
import { setAuraLanguage } from "@/lib/aura-audio";

// ---------------------------------------------------------------------------
// Clerk setup
// ---------------------------------------------------------------------------
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL as string | undefined;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY — Clerk is not configured.");
}

const clerkAppearance = {
  baseTheme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#22c55e",
    colorForeground: "#f8fafc",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#0f172a",
    colorInput: "#1e293b",
    colorInputForeground: "#f8fafc",
    colorNeutral: "#334155",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox:
      "bg-slate-900 rounded-2xl w-[440px] max-w-full overflow-hidden border border-slate-700",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white",
    headerSubtitle: "text-slate-400",
    socialButtonsBlockButtonText: "text-white",
    formFieldLabel: "text-slate-300",
    footerActionLink: "text-green-400",
    footerActionText: "text-slate-400",
    dividerText: "text-slate-500",
    identityPreviewEditButton: "text-green-400",
    formFieldSuccessText: "text-green-400",
    alertText: "text-white",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border-slate-600 bg-slate-800",
    formButtonPrimary: "bg-green-500 hover:bg-green-400 text-white",
    formFieldInput: "bg-slate-800 border-slate-600 text-white",
    footerAction: "bg-slate-800/50",
    dividerLine: "bg-slate-700",
    alert: "bg-red-900/30 border-red-800",
    otpCodeFieldInput: "bg-slate-800 border-slate-600 text-white",
    formFieldRow: "",
    main: "",
  },
};

// ---------------------------------------------------------------------------
// QueryClient
// ---------------------------------------------------------------------------
const queryClient = new QueryClient();

// ---------------------------------------------------------------------------
// Applies RTL direction whenever the active language changes
// ---------------------------------------------------------------------------
function RTLDirectionSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const lang = i18n.language?.split("-")[0] ?? "en";
    const dir = isRTL(lang) ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language ?? "en";
  }, [i18n.language]);
  return null;
}

// ---------------------------------------------------------------------------
// Syncs preferred language from the DB profile to i18n on sign-in / page load.
// This enables cross-device language/currency consistency.
// ---------------------------------------------------------------------------
function LangSync() {
  const { data: profile } = useMyProfile();
  const { isSignedIn } = useUser();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (!isSignedIn || !profile?.preferredLanguage) return;
    if (profile.preferredLanguage !== i18n.language) {
      void i18n.changeLanguage(profile.preferredLanguage);
      setVoiceLanguage(profile.preferredLanguage);
      setAuraLanguage(profile.preferredLanguage);
    }
  // Only run when the profile loads — don't re-run on every i18n change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.preferredLanguage, isSignedIn]);

  return null;
}

// ---------------------------------------------------------------------------
// Syncs the Clerk user to the app's DB on first sign-in
// ---------------------------------------------------------------------------
function ProfileSync() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const upsertProfile = useUpsertProfile();
  const didAttemptRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    if (profileLoading) return;
    if (profile !== null) return; // already exists
    if (didAttemptRef.current) return;
    didAttemptRef.current = true;

    // Derive default username: prefer Clerk username, fall back to uid-based slug
    const rawUsername =
      user.username ??
      `athlete${user.id.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase()}`;
    const safeUsername = rawUsername
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 32);

    const displayName =
      user.fullName ?? user.firstName ?? safeUsername;

    upsertProfile.mutate({
      username: safeUsername,
      displayName,
      avatarUrl: user.imageUrl ?? undefined,
    });
  }, [isLoaded, isSignedIn, user, profile, profileLoading]);

  return null;
}

// ---------------------------------------------------------------------------
// Invalidates the React Query cache when the signed-in user changes
// ---------------------------------------------------------------------------
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

// ---------------------------------------------------------------------------
// Home route: landing for signed-out, dashboard for signed-in
// ---------------------------------------------------------------------------
function HomeRoute() {
  return (
    <>
      <Show when="signed-in">
        <Home />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

// ---------------------------------------------------------------------------
// Router — all routes live here inside ClerkProvider
// ---------------------------------------------------------------------------
function AppRouter() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: { title: "Welcome back", subtitle: "Sign in to CaliCoach" },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start your calisthenics journey",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <RTLDirectionSync />
        <LangSync />
        <ClerkQueryClientCacheInvalidator />
        <ProfileSync />
        <UploadManagerProvider>
          <TooltipProvider>
            <Switch>
              {/* Full-screen takeover — no sidebar/layout wrapper */}
              <Route path="/mobility-session">{() => <MobilityPage autoStart={true} />}</Route>
              <Route path="/admin/anim-lab">{() => <AnimLabPage />}</Route>

              {/* All other routes rendered inside the sidebar Layout */}
              <Route>{() => (
                <Layout>
                  <Switch>
                    <Route path="/" component={HomeRoute} />
                    <Route path="/sign-in/*?" component={SignInPage} />
                    <Route path="/sign-up/*?" component={SignUpPage} />
                    {/* ── Hub routes (new consolidated tabs) ─────────── */}
                    <Route path="/training" component={TrainingHub} />
                    <Route path="/mastery" component={MasteryHub} />
                    <Route path="/community" component={CommunityHub} />
                    {/* ── Legacy sub-routes (deep links still work) ──── */}
                    <Route path="/workout" component={Workout} />
                    <Route path="/history" component={History} />
                    <Route path="/session/:id" component={SessionDetail} />
                    <Route path="/progress" component={Progress} />
                    <Route path="/exercises" component={Exercises} />
                    <Route path="/feed" component={CommunityFeedPage} />
                    <Route path="/skill-tree" component={SkillTreePage} />
                    <Route path="/leaderboard" component={Leaderboard} />
                    <Route path="/friends" component={Friends} />
                    <Route path="/profile/:username" component={ProfilePage} />
                    <Route path="/settings" component={Settings} />
                    <Route path="/shop" component={ShopPage} />
                    <Route path="/calibration" component={BodyCalibration} />
                    <Route path="/mobility">{() => <MobilityPage />}</Route>
                    <Route path="/terms" component={TermsPage} />
                    <Route path="/privacy" component={PrivacyPage} />
                    <Route component={NotFound} />
                  </Switch>
                </Layout>
              )}</Route>
            </Switch>
            <Toaster />
          </TooltipProvider>
        </UploadManagerProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
// Purge expired clips once on startup (sync localStorage call, negligible cost)
purgeExpiredClips();

function App() {
  return (
    <WouterRouter base={basePath}>
      <AppRouter />
    </WouterRouter>
  );
}

export default App;
