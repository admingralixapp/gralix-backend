import { useState } from "react";
import { GitBranch, History as HistoryIcon, BarChart2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { SkillTreePage } from "./skill-tree";
import { History } from "./history";
import { Progress } from "./progress";

type Tab = "skill-tree" | "history" | "progress";

export function MasteryHub() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("skill-tree");

  return (
    <div className="flex flex-col min-h-full">
      <div
        className="sticky top-0 z-20 flex border-b border-white/[0.06]"
        style={{ background: "rgba(10,15,26,0.92)", backdropFilter: "blur(16px)" }}
      >
        <button
          onClick={() => setTab("skill-tree")}
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
          onClick={() => setTab("history")}
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
          onClick={() => setTab("progress")}
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
