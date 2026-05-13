import { useState } from "react";
import { Trophy, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Leaderboard } from "./leaderboard";
import { Friends } from "./friends";

type Tab = "leaderboard" | "friends";

export function CommunityHub() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("leaderboard");

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 flex items-center border-b border-white/[0.06]"
        style={{ background: "rgba(10,15,26,0.92)", backdropFilter: "blur(16px)" }}
      >
        <div className="flex flex-1">
          {/* Leaderboard */}
          <button
            onClick={() => setTab("leaderboard")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all border-b-2",
              tab === "leaderboard"
                ? "border-yellow-400 text-yellow-400"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Trophy className="w-4 h-4" />
            {t("nav.leaderboard", "Leaderboard")}
          </button>

          {/* Friends */}
          <button
            onClick={() => setTab("friends")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all border-b-2",
              tab === "friends"
                ? "border-blue-400 text-blue-400"
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
        {tab === "leaderboard" && <Leaderboard />}
        {tab === "friends"     && <Friends />}
      </div>
    </div>
  );
}
