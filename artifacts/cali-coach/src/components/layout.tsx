import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Show, useUser, useClerk } from "@clerk/react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import {
  Activity,
  LayoutDashboard,
  History,
  TrendingUp,
  GitBranch,
  Users,
  Settings,
  LogIn,
  LogOut,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyProfile, useFriendRequests } from "@/lib/social";
import { SkillWatcher } from "./skill-watcher";

// ─── Nav definition ───────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requireAuth?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/",           label: "Dashboard",  icon: LayoutDashboard },
  { href: "/workout",    label: "Workout",     icon: Activity },
  { href: "/history",    label: "History",     icon: History },
  { href: "/progress",   label: "Progress",    icon: TrendingUp },
  { href: "/skill-tree", label: "Skill Tree",  icon: GitBranch },
  { href: "/leaderboard",label: "Leaderboard", icon: Trophy },
  { href: "/friends",    label: "Friends",     icon: Users,     requireAuth: true },
  { href: "/settings",   label: "Settings",    icon: Settings,  requireAuth: true },
];

/** The three tabs reachable by swiping left / right. */
const SWIPEABLE_ROUTES = ["/", "/workout", "/skill-tree"] as const;

// ─── Animation config ─────────────────────────────────────────────────────────

const springTransition = { type: "spring" as const, stiffness: 300, damping: 30 };

/**
 * Layered Zoom variants.
 *
 * Outgoing page:
 *   • Scales down to 0.95 and dims to 80% brightness — looks like it's
 *     receding into the background.
 *   • Gets zIndex: 1 so the incoming layer slides over it.
 *
 * Incoming page:
 *   • Enters at scale 1.05, slides to scale 1.
 *   • Gets zIndex: 2 — always on top.
 *
 * dir ≥ 0  → moving right in nav  → enter from right, exit to left
 * dir < 0  → moving left in nav   → enter from left,  exit to right
 */
const pageVariants = {
  enter: (dir: number) => ({
    x:      dir >= 0 ? "100%" : "-100%",
    scale:  1.05,
    filter: "brightness(1)",
    zIndex: 2,
  }),
  center: {
    x:      0,
    scale:  1,
    filter: "brightness(1)",
    zIndex: 2,
  },
  exit: (dir: number) => ({
    x:      dir >= 0 ? "-8%" : "8%",   // subtle push — mimics iOS card stack
    scale:  0.95,
    filter: "brightness(0.8)",
    zIndex: 1,
  }),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function triggerHaptic() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as Navigator & { vibrate(pattern: number | number[]): boolean }).vibrate(10);
    }
  } catch { /* not supported, silently ignore */ }
}

function getNavIndex(path: string): number {
  return NAV_ITEMS.findIndex(item =>
    item.href === "/" ? path === "/" : path.startsWith(item.href),
  );
}

// ─── UserSection ──────────────────────────────────────────────────────────────

function UserSection() {
  const { user, isLoaded } = useUser();
  const { signOut }        = useClerk();
  const { data: profile }  = useMyProfile();
  const { data: requests } = useFriendRequests();
  void requests;

  if (!isLoaded) return null;

  return (
    <>
      <Show when="signed-in">
        <div className="p-4 border-t border-border">
          <button
            onClick={() => window.location.assign("/settings")}
            className="w-full flex items-center gap-3 group hover:bg-secondary/50 rounded-md p-2 transition-colors text-left"
          >
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt="avatar"
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
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
            onClick={() => signOut()}
            className="mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
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
            Sign In
          </a>
        </div>
      </Show>
    </>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [direction, setDirection] = useState(0);

  // Touch tracking refs
  const touchStartX    = useRef(0);
  const touchStartY    = useRef(0);
  const isDraggingRef  = useRef(false);

  // ── Live drag MotionValues ────────────────────────────────────────────────
  //
  // `dragProgress` is a 0→1 value representing how far the user has dragged
  // relative to half the viewport width. We use this to proportionally shrink
  // and dim the current page while the finger is moving — giving tactile
  // feedback before the committed navigation animates in.
  //
  const dragProgress  = useMotionValue(0);
  const contentScale  = useTransform(dragProgress, [0, 1], [1, 0.95]);
  const contentBright = useTransform(dragProgress, [0, 1], [1, 0.8]);
  const contentFilter = useTransform(contentBright, (b) => `brightness(${b})`);

  // ── Core navigation fn ───────────────────────────────────────────────────
  const navigateTo = useCallback((href: string) => {
    if (href === location) return;
    const currentIdx = getNavIndex(location);
    const nextIdx    = getNavIndex(href);
    setDirection(nextIdx >= currentIdx ? 1 : -1);
    triggerHaptic();
    // Snap the drag wrapper back to idle before the new page enters
    animate(dragProgress, 0, { duration: 0.15 });
    setLocation(href);
  }, [location, setLocation, dragProgress]);

  // ── Swipe gesture ────────────────────────────────────────────────────────
  useEffect(() => {
    const MIN_SWIPE_X = 60;
    const MAX_Y_RATIO = 0.65;

    function onTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isDraggingRef.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      const deltaX = e.touches[0].clientX - touchStartX.current;
      const deltaY = e.touches[0].clientY - touchStartY.current;

      // Only apply drag effect for mostly-horizontal swipes on swipeable routes
      if (Math.abs(deltaY) / Math.abs(deltaX) > MAX_Y_RATIO) return;

      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [role="slider"], video, canvas, [data-no-swipe]')) return;

      const swipeIdx = SWIPEABLE_ROUTES.findIndex(r =>
        r === "/" ? location === "/" : location.startsWith(r),
      );
      if (swipeIdx === -1) return;

      // Only apply if dragging toward a valid tab
      const canGoNext = deltaX < 0 && swipeIdx < SWIPEABLE_ROUTES.length - 1;
      const canGoPrev = deltaX > 0 && swipeIdx > 0;
      if (!canGoNext && !canGoPrev) return;

      isDraggingRef.current = true;
      const halfW   = window.innerWidth / 2;
      const progress = Math.min(1, Math.abs(deltaX) / halfW);
      dragProgress.set(progress);
    }

    function onTouchEnd(e: TouchEvent) {
      // Animate back to 0 before (possibly) triggering navigate
      animate(dragProgress, 0, { duration: 0.2, ease: "easeOut" });

      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

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
    document.addEventListener("touchmove",  onTouchMove,  { passive: true });
    document.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove",  onTouchMove);
      document.removeEventListener("touchend",   onTouchEnd);
    };
  }, [location, navigateTo, dragProgress]);

  // ── Full-screen pages (workout, sign-in, sign-up) ────────────────────────
  const isFullscreen =
    location === "/workout" ||
    location.startsWith("/sign-in") ||
    location.startsWith("/sign-up");

  if (isFullscreen) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        {children}
      </main>
    );
  }

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  // ── Sidebar-layout render ────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card shrink-0">
        <div className="p-6">
          <button
            onClick={() => navigateTo("/")}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">CaliCoach</span>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => navigateTo(item.href)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-colors font-medium text-sm text-left",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <UserSection />
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card z-50 flex justify-around p-2">
        {NAV_ITEMS.filter(item => !item.requireAuth).map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <button
              key={item.href}
              onClick={() => navigateTo(item.href)}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-md relative transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] mt-0.5 font-medium">{item.label}</span>
              {active && (
                <motion.div
                  layoutId="mobile-nav-indicator"
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                  transition={springTransition}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Animated Main Content */}
      <main className="flex-1 pb-20 md:pb-0 overflow-hidden relative">

        {/*
          Drag-responsive wrapper — applies live scale + brightness as the
          user's finger moves, before navigation commits. Once the user lifts
          their finger and the route changes, AnimatePresence takes over with
          the full layered zoom variant animation.
        */}
        <motion.div
          className="absolute inset-0"
          style={{ scale: contentScale, filter: contentFilter }}
        >
          <AnimatePresence initial={false} custom={direction} mode="sync">
            <motion.div
              key={location}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springTransition}
              className="absolute inset-0 overflow-y-auto"
            >
              <div className="max-w-6xl mx-auto">
                {children}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </main>

      <SkillWatcher />
    </div>
  );
}
