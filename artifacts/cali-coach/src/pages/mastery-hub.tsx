import { useState, useEffect } from "react";
import { GitBranch, History as HistoryIcon, BarChart2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { SkillTreePage } from "./skill-tree";
import { History } from "./history";
import { Progress } from "./progress";

type Tab = "skill-tree" | "history" | "progress";

const VALID_TABS = new Set<Tab>(["skill-tree", "history", "progress"]);

function getTabFromSearch(): Tab {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("tab");
  return VALID_TABS.has(raw as Tab) ? (raw as Tab) : "skill-tree";
}

export function MasteryHub() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>(getTabFromSearch);

  // Sync when the URL changes externally (e.g. browser back/forward or View All link)
  useEffect(() => {
    const sync = () => setTab(getTabFromSearch());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  function switchTab(next: Tab) {
    setTab(next);
    // Update URL without triggering a full navigation so wouter doesn't remount
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    window.history.replaceState(null, "", `/mastery?${params.toString()}`);
  }

  return (
    <div className="flex flex-col min-h-full">
      <div
        className="sticky top-0 z-20 flex border-b border-white/[0.06]"
        style={{ background: "rgba(10,15,26,0.92)", backdropFilter: "blur(16px)" }}
      >
        <button
          onClick={() => switchTab("skill-tree")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all border-b-2",
            tab === "skill-tree"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <GitBranch className="w-4 h-4" />
          {t("nav.skillTree", "Skill Tree")}
        </button>

        <button
          onClick={() => switchTab("history")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all border-b-2",
            tab === "history"
              ? "border-amber-400 text-amber-400"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <HistoryIcon className="w-4 h-4" />
          {t("nav.history", "History")}
        </button>

        <button
          onClick={() => switchTab("progress")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all border-b-2",
            tab === "progress"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <BarChart2 className="w-4 h-4" />
          {t("nav.progress", "Progress")}
        </button>
      </div>

      <div className="flex-1">
        {tab === "skill-tree" && <SkillTreePage />}
        {tab === "history"    && <History />}
        {tab === "progress"   && <Progress />}
      </div>
    </div>
  );
}
