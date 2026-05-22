import { useState } from "react";
import { Activity, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Leaderboard } from "./leaderboard";
import { Friends } from "./friends";

type Tab = "activity" | "friends";

export function CommunityHub() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("activity");

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center border-b border-border bg-background">
        <div className="flex flex-1">
          {/* Activity Ledger */}
          <button
            onClick={() => setTab("activity")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all border-b-2",
              tab === "activity"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Activity className="w-4 h-4" />
            Activity
          </button>

          {/* Friends */}
          <button
            onClick={() => setTab("friends")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all border-b-2",
              tab === "friends"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="w-4 h-4" />
            {t("nav.friends", "Friends")}
          </button>
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="flex-1">
        {tab === "activity" && <Leaderboard />}
        {tab === "friends"  && <Friends />}
      </div>
    </div>
  );
}
