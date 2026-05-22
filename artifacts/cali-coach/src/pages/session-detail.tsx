import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useGetSession } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import {
  ArrowLeft, Target, Activity, Clock, Video, Download, Play, Pause,
  ShieldCheck, Clock3, Share2, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { getClip, daysUntilExpiry } from "@/lib/clip-store";
import { useToast } from "@/hooks/use-toast";

// ─── Inline video player ──────────────────────────────────────────────────────

function ClipPlayer({ objectPath }: { objectPath: string }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useState<HTMLVideoElement | null>(null);

  const src = objectPath.startsWith("http") ? objectPath : `/api/storage${objectPath}`;

  return (
    <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
      <video
        ref={(el) => { (videoRef as unknown as { current: HTMLVideoElement | null }).current = el; }}
        src={src}
        loop
        muted
        playsInline
        className="w-full h-full object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        onClick={() => {
          const el = (videoRef as unknown as { current: HTMLVideoElement | null }).current;
          if (!el) return;
          if (el.paused) { void el.play(); } else { el.pause(); }
        }}
        className="absolute inset-0 flex items-center justify-center group"
      >
        <div className={`w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center transition-opacity ${playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}>
          {playing
            ? <Pause className="w-6 h-6 text-white" />
            : <Play  className="w-6 h-6 text-white ml-1" />}
        </div>
      </button>
    </div>
  );
}

// ─── Download / share clip helper ────────────────────────────────────────────

function useClipDownload() {
  const { toast } = useToast();

  return useCallback(async (objectPath: string, exerciseName: string) => {
    const src = objectPath.startsWith("http") ? objectPath : `/api/storage${objectPath}`;

    try {
      const res  = await fetch(src);
      if (!res.ok) throw new Error("Could not fetch clip");
      const blob = await res.blob();
      const ext  = blob.type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `calicoach-${exerciseName.replace(/\s+/g, "-").toLowerCase()}.${ext}`, { type: blob.type });

      // Try Web Share API first (mobile / PWA)
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: `My ${exerciseName} form — CaliCoach`,
            text:  "Show off your form! Analyzed by AI. 🏋️ #CaliCoach",
            files: [file],
          });
          return;
        } catch {
          // User cancelled or share not supported — fall through to download
        }
      }

      // Fallback: direct download
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      toast({
        title: "Clip saved!",
        description: "Show off your form — share your analyzed clip to social media.",
      });
    } catch {
      toast({ title: "Could not download clip", variant: "destructive" });
    }
  }, [toast]);
}

// ─── SessionDetail ────────────────────────────────────────────────────────────

export function SessionDetail() {
  const { t } = useTranslation();
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data: session, isLoading } = useGetSession(id, {
    query: { queryKey: [`/api/sessions/${id}`], enabled: !!id },
  });
  const [downloading, setDownloading] = useState(false);
  const downloadClip = useClipDownload();

  if (isLoading) {
    return <div className="p-8">Loading…</div>;
  }

  if (!session) {
    return <div className="p-8">Session not found.</div>;
  }

  const clip    = getClip(id);
  const expires = clip ? daysUntilExpiry(id) : null;

  const durationStr = session.completedAt
    ? `${Math.round(
        (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000,
      )} min`
    : "--";

  const handleDownload = async () => {
    if (!clip) return;
    setDownloading(true);
    await downloadClip(clip.objectPath, session.exerciseName);
    setDownloading(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" asChild className="pl-0 hover:bg-transparent hover:text-primary">
        <Link href="/history">
          <ArrowLeft className="w-4 h-4 mr-2" /> {t("session.backToHistory")}
        </Link>
      </Button>

      {/* Title */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{session.exerciseName}</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(session.startedAt), "MMMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        {session.isVerified && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border"
            style={{ color: "#177548", borderColor: "#177548", background: "rgba(23,117,72,0.07)" }}>
            <ShieldCheck className="w-3.5 h-3.5" />
            {t("session.aiVerified")}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t("session.totalReps")}</div>
              <div className="text-3xl font-bold">{session.totalReps}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t("session.avgFormScore")}</div>
              <div className="text-3xl font-bold">
                {session.avgFormScore ? Math.round(session.avgFormScore) : "--"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">{t("session.duration")}</div>
              <div className="text-3xl font-bold">{durationStr}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Clip section ─────────────────────────────────────────────────────── */}
      {clip ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-blue-400" />
                {t("session.savedClip")}
              </CardTitle>
              <div className="flex items-center gap-3">
                {expires !== null && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="w-3 h-3" />
                    {t("session.expiresInDays", { count: expires })}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading
                    ? <span className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    : <Download className="w-3.5 h-3.5" />}
                  {downloading ? "Preparing…" : "Download Clip"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ClipPlayer objectPath={clip.objectPath} />
            {/* Social share nudge */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: "linear-gradient(135deg, rgba(34,197,94,0.07), rgba(88,28,135,0.07))",
                border:     "1px solid rgba(34,197,94,0.18)",
              }}
            >
              <Share2 className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary">Show off your form!</p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  Share your AI-analyzed clip to Instagram Stories or TikTok.
                </p>
              </div>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  background: "rgba(34,197,94,0.15)",
                  border:     "1px solid rgba(34,197,94,0.30)",
                  color:      "#22c55e",
                }}
              >
                Share
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("session.loopsNote", { count: expires ?? 0 })}
            </p>
          </CardContent>
        </Card>
      ) : session.isVerified && session.logType === "ai" ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Video className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {t("session.noClipSaved")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Form score chart */}
      {session.reps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              {t("session.formScoreByRep")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={session.reps}>
                  <XAxis
                    dataKey="repNumber"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor:     "hsl(var(--border))",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <ReferenceLine y={80} stroke="hsl(var(--primary))"     strokeDasharray="3 3" opacity={0.5} />
                  <ReferenceLine y={60} stroke="hsl(var(--destructive))" strokeDasharray="3 3" opacity={0.5} />
                  <Line
                    type="monotone"
                    dataKey="formScore"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {session.notes && (
        <Card>
          <CardHeader>
            <CardTitle>{t("session.notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
