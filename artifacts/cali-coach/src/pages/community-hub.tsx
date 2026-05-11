import { useState } from "react";
import { Trophy, Users, UserPlus } from "lucide-react";
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
      <div
        className="sticky top-0 z-20 flex items-center border-b border-white/[0.06]"
        style={{ background: "rgba(10,15,26,0.92)", backdropFilter: "blur(16px)" }}
      >
        <div className="flex flex-1">
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

        {/* Add Friend button — always in top-right, switches to friends tab */}
        <button
          onClick={() => setTab("friends")}
          className="mr-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
          style={{
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.3)",
            color: "#22c55e",
          }}
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("friends.addFriend", "Add Friend")}</span>
        </button>
      </div>

      <div className="flex-1">
        {tab === "leaderboard" ? <Leaderboard /> : <Friends />}
      </div>
    </div>
  );
}
