import { Link, useLocation } from "wouter";
import { Show, useUser, useClerk } from "@clerk/react";
import {
  Activity,
  LayoutDashboard,
  History,
  TrendingUp,
  Dumbbell,
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

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workout", label: "Workout", icon: Activity },
  { href: "/history", label: "History", icon: History },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/skill-tree", label: "Skill Tree", icon: GitBranch },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/friends", label: "Friends", icon: Users, requireAuth: true },
  { href: "/settings", label: "Settings", icon: Settings, requireAuth: true },
];

function UserSection() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { data: profile } = useMyProfile();
  const { data: requests } = useFriendRequests();
  const pendingCount = requests?.incoming?.length ?? 0;

  if (!isLoaded) return null;

  return (
    <>
      <Show when="signed-in">
        <div className="p-4 border-t border-border">
          <Link
            href="/settings"
            className="flex items-center gap-3 group hover:bg-secondary/50 rounded-md p-2 transition-colors"
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
          </Link>
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
          <Link
            href="/sign-in"
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </Link>
        </div>
      </Show>
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  // Full-screen pages (no sidebar)
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

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">CaliCoach</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? location === "/"
                : location.startsWith(item.href);
            const Icon = item.icon;

            const content = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md transition-colors font-medium text-sm relative",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </Link>
            );

            return content;
          })}
        </nav>

        <UserSection />
      </aside>

      {/* Mobile Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card z-50 flex justify-around p-2">
        {NAV_ITEMS.filter((item) => !item.requireAuth || true).slice(0, 7).map(
          (item) => {
            const isActive =
              item.href === "/"
                ? location === "/"
                : location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-md",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] mt-0.5 font-medium">{item.label}</span>
              </Link>
            );
          },
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>

      {/* Global skill watcher — detects new Elite masteries and fires celebration */}
      <SkillWatcher />
    </div>
  );
}
