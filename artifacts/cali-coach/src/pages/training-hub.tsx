import { useState } from "react";
import { useSearch } from "wouter";
import { Activity, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Workout } from "./workout";
import { MobilityPage } from "./mobility";

type Tab = "workout" | "mobility";

export function TrainingHub() {
  const { t }  = useTranslation();
  const search = useSearch();
  const initialTab: Tab = new URLSearchParams(search).get("tab") === "daily" ? "mobility" : "workout";
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="flex flex-col min-h-full">
      <div
        className="sticky top-0 z-[60] flex border-b border-border bg-background"
      >
        <button
          onClick={() => setTab("workout")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all border-b-2",
            tab === "workout"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Activity className="w-4 h-4" />
          {t("nav.workout", "Workout")}
        </button>
        <button
          onClick={() => setTab("mobility")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all border-b-2",
            tab === "mobility"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Sparkles className="w-4 h-4" />
          {t("nav.daily", "Daily Mobility")}
        </button>
      </div>

      <div className="flex-1">
        {tab === "workout" ? <Workout /> : <MobilityPage />}
      </div>
    </div>
  );
}
