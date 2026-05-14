import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Show, useUser, useClerk } from "@clerk/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  LayoutDashboard,
  GitBranch,
  Users,
  Settings,
  LogIn,
  LogOut,
  ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyProfile, useFriendRequests } from "@/lib/social";
import { SkillWatcher } from "./skill-watcher";
import { BadgeCelebrationProvider } from "./badge-celebration-context";

// ─── Nav definition ───────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",          label: "Home",      labelKey: "nav.dashboard",  icon: LayoutDashboard },
  { href: "/training",  label: "Training",  labelKey: "nav.training",   icon: Activity },
  { href: "/mastery",   label: "Mastery",   labelKey: "nav.mastery",    icon: GitBranch },
  { href: "/community", label: "Community", labelKey: "nav.community",  icon: Users },
  { href: "/shop",      label: "Shop",      labelKey: "nav.shop",       icon: ShoppingBag },
];

/**
 * Maps legacy sub-routes to their new parent tab so isActive highlights correctly.
 */
const LEGACY_ROUTE_MAP: Record<string, string> = {
  "/workout":     "/training",
  "/daily-tasks": "/training",
  "/mobility":    "/training",
  "/skill-tree":  "/mastery",
  "/history":     "/mastery",
  "/progress":    "/mastery",
  "/leaderboard": "/community",
  "/friends":     "/community",
};

/** Swipeable top-level tabs */
const SWIPEABLE_ROUTES = ["/", "/training", "/mastery", "/community", "/shop"] as const;

// ─── Animation config ─────────────────────────────────────────────────────────

const springTransition = { type: "spring" as const, stiffness: 300, damping: 30 };

const pageVariants = {
  enter:  (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%", opacity: 0, zIndex: 0 }),
  center:                   { x: 0,                             opacity: 1, zIndex: 1 },
  exit:   (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%", opacity: 0, zIndex: 0 }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as Navigator & { vibrate(pattern: number | number[]): boolean }).vibrate(10);
    }
  } catch { /* not supported */ }
}

function resolveTab(path: string): string {
  // Check exact match in legacy map
  for (const [prefix, tab] of Object.entries(LEGACY_ROUTE_MAP)) {
    if (path === prefix || path.startsWith(prefix + "/")) return tab;
  }
  return path;
}

function getNavIndex(path: string): number {
  const tab = resolveTab(path);
  return NAV_ITEMS.findIndex(item =>
    item.href === "/" ? tab === "/" : tab.startsWith(item.href),
  );
}

// ─── UserSection ──────────────────────────────────────────────────────────────

/** Keys that are user-specific and must be purged on every account switch/logout. */
const USER_SESSION_LS_KEYS = [
  "calicoach_tour_pending",
  "calicoach_joint_readiness_v1",
  "calicoach_body_weight_v1",
  "calicoach_clips_v1",
];

export function clearUserSessionStorage() {
  USER_SESSION_LS_KEYS.forEach((k) => localStorage.removeItem(k));
}

function UserSection() {
  const { t }              = useTranslation();
  const { user, isLoaded } = useUser();
  const { signOut }        = useClerk();
  const { data: profile }  = useMyProfile();
  const { data: requests } = useFriendRequests();
  const [, setLocation]    = useLocation();
  void requests;

  async function handleSignOut() {
    clearUserSessionStorage();
    await signOut();
  }

  if (!isLoaded) return null;

  const profileHref = profile?.username
    ? `/profile/${profile.username}`
    : "/settings";

  return (
    <>
      <Show when="signed-in">
        <div className="p-4 border-t border-border">
          <button
            onClick={() => setLocation(profileHref)}
            className="w-full flex items-center gap-3 group hover:bg-secondary/50 rounded-md p-2 transition-colors text-left"
          >
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {(profile?.displayName ?? user?.firstName ?? "U")[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {profile?.displayName ?? user?.fullName ?? user?.firstName ?? "Athlete"}
              </div>
              {profile?.username && (
                <div className="text-xs text-muted-foreground truncate">
                  @{profile.username}
                </div>
              )}
            </div>
          </button>
          <button
            onClick={handleSignOut}
            className="mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t("common.signOut", "Sign out")}
          </button>
        </div>
      </Show>

      <Show when="signed-out">
        <div className="p-4 border-t border-border">
          <a
            href="/sign-in"
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            {t("common.signIn", "Sign In")}
          </a>
        </div>
      </Show>
    </>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [direction, setDirection] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const mobileNavRef = useRef<HTMLElement>(null);
  const navItemRefs  = useRef<Map<string, HTMLButtonElement>>(new Map());

  // ── Core navigation fn ───────────────────────────────────────────────────
  const navigateTo = useCallback((href: string) => {
    if (href === location) return;
    const currentIdx = getNavIndex(location);
    const nextIdx    = getNavIndex(href);
    setDirection(nextIdx >= currentIdx ? 1 : -1);
    triggerHaptic();
    setLocation(href);
  }, [location, setLocation]);

  // ── Auto-center active tab in mobile nav ─────────────────────────────────
  useEffect(() => {
    const tab = resolveTab(location);
    const activeItem = NAV_ITEMS.find(item =>
      item.href === "/" ? tab === "/" : tab.startsWith(item.href),
    );
    if (!activeItem) return;
    const el = navItemRefs.current.get(activeItem.href);
    if (el && mobileNavRef.current) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [location]);

  // ── Swipe gesture ────────────────────────────────────────────────────────
  useEffect(() => {
    const MIN_SWIPE_X = 60;
    const MAX_Y_RATIO = 0.65;

    function onTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }

    function onTouchEnd(e: TouchEvent) {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;

      if (Math.abs(deltaX) < MIN_SWIPE_X) return;
      if (Math.abs(deltaY) / Math.abs(deltaX) > MAX_Y_RATIO) return;

      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [role="slider"], video, canvas, [data-no-swipe]')) return;

      const currentSwipeIdx = SWIPEABLE_ROUTES.findIndex(r =>
        r === "/" ? location === "/" : location.startsWith(r),
      );
      if (currentSwipeIdx === -1) return;

      if (deltaX < 0 && currentSwipeIdx < SWIPEABLE_ROUTES.length - 1) {
        navigateTo(SWIPEABLE_ROUTES[currentSwipeIdx + 1]);
      } else if (deltaX > 0 && currentSwipeIdx > 0) {
        navigateTo(SWIPEABLE_ROUTES[currentSwipeIdx - 1]);
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend",   onTouchEnd);
    };
  }, [location, navigateTo]);

  // ── Full-screen pages ────────────────────────────────────────────────────
  const isFullscreen =
    location.startsWith("/sign-in") ||
    location.startsWith("/sign-up");

  if (isFullscreen) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        {children}
      </main>
    );
  }

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    const tab = resolveTab(location);
    return tab.startsWith(href) || location.startsWith(href);
  };

  const isSettingsActive = location.startsWith("/settings");

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">

      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 flex-col border-r border-white/[0.06] glass-nav shrink-0">
        {/* Logo */}
        <div className="p-6">
          <button onClick={() => navigateTo("/")} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center neon-glow">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-extrabold text-xl tracking-tight">CaliCoach</span>
          </button>
        </div>

        {/* Main 5 tabs */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon   = item.icon;
            const active = isActive(item.href);
            const tourId = item.href === "/" ? "tour-desktop-home" : item.href === "/training" ? "tour-desktop-training" : item.href === "/mastery" ? "tour-desktop-mastery" : undefined;
            return (
              <button
                key={item.href}
                id={tourId}
                onClick={() => navigateTo(item.href)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm text-left",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )}
              >
                <Icon className={cn("w-5 h-5 shrink-0", active && "nav-icon-active")} />
                <span className="flex-1">{t(item.labelKey, item.label)}</span>
              </button>
            );
          })}
        </nav>

        {/* Settings — separate, pinned above user section */}
        <div className="px-4 pb-2">
          <button
            onClick={() => navigateTo("/settings")}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-sm text-left",
              isSettingsActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            <Settings className={cn("w-4 h-4 shrink-0", isSettingsActive && "nav-icon-active")} />
            <span>{t("nav.settings", "Settings")}</span>
          </button>
        </div>

        <UserSection />
      </aside>

      {/* ── Mobile Bottom Nav ───────────────────────────────────────────── */}
      <nav
        ref={mobileNavRef}
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] glass-nav flex items-end pb-safe"
        style={{ scrollbarWidth: "none" } as React.CSSProperties}
      >
        {/* 5 main tabs */}
        <div className="flex flex-1 overflow-x-auto px-1" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
          <style>{`div::-webkit-scrollbar { display: none; }`}</style>
          {NAV_ITEMS.map((item) => {
            const Icon   = item.icon;
            const active = isActive(item.href);
            const mobileTourId = item.href === "/" ? "tour-mobile-home" : item.href === "/training" ? "tour-mobile-training" : item.href === "/mastery" ? "tour-mobile-mastery" : undefined;
            return (
              <button
                key={item.href}
                id={mobileTourId}
                ref={(el) => {
                  if (el) navItemRefs.current.set(item.href, el);
                  else navItemRefs.current.delete(item.href);
                }}
                onClick={() => navigateTo(item.href)}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center justify-center px-3.5 py-2.5 rounded-xl relative transition-all",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                style={{ minWidth: 60 }}
              >
                <div className="relative">
                  <Icon className={cn("w-5 h-5", active && "nav-icon-active")} />
                </div>
                <span className={cn(
                  "text-[9px] mt-0.5 whitespace-nowrap",
                  active ? "font-bold" : "font-light opacity-80",
                )}>
                  {t(item.labelKey, item.label)}
                </span>
                {active && (
                  <motion.div
                    layoutId="mobile-nav-indicator"
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                    style={{ boxShadow: "0 0 6px rgba(0,255,100,0.8)" }}
                    transition={springTransition}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Settings — small icon at far right, visually separated */}
        <button
          onClick={() => navigateTo("/settings")}
          className={cn(
            "flex-shrink-0 flex flex-col items-center justify-center px-3 py-2.5 border-l border-white/[0.06] transition-all",
            isSettingsActive ? "text-primary" : "text-muted-foreground/60",
          )}
        >
          <Settings className="w-4 h-4" />
          <span className="text-[8px] mt-0.5 font-light opacity-70">{t("nav.settings", "Settings")}</span>
        </button>
      </nav>

      {/* ── Animated Main Content ───────────────────────────────────────── */}
      <main className="flex-1 pb-[72px] md:pb-0 overflow-hidden relative">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={location}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={springTransition}
            className="absolute inset-0 overflow-y-auto"
            style={{ willChange: "transform, opacity", transform: "translateZ(0)" }}
          >
            <div className="max-w-6xl mx-auto pb-[120px] md:pb-8">
              {children}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      <SkillWatcher />
    </div>
  );
}

// Re-export the provider so App.tsx / tests can import from one place.
export { BadgeCelebrationProvider } from "./badge-celebration-context";
