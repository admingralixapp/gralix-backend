import { useState } from "react";
import { useGetSession } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import {
  ArrowLeft, Target, Activity, Clock, Video, Share2, Play, Pause,
  ShieldCheck, Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { getClip, daysUntilExpiry } from "@/lib/clip-store";
import { ShareToFeedSheet } from "@/components/share-to-feed-sheet";

// ─── Inline video player ──────────────────────────────────────────────────────

function ClipPlayer({ objectPath }: { objectPath: string }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useState<HTMLVideoElement | null>(null);

  // Build a served URL from the objectPath
  // objectPath is like "/objects/uploads/xxx.webm" or similar
  const src = objectPath.startsWith("http") ? objectPath : objectPath;

  return (
    <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
      <video
        ref={(el) => { (videoRef as unknown as { current: HTMLVideoElement | null }).current = el; }}
        src={src}
        loop
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

// ─── SessionDetail ────────────────────────────────────────────────────────────

export function SessionDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data: session, isLoading } = useGetSession(id, {
    query: { queryKey: [`/api/sessions/${id}`], enabled: !!id },
  });
  const [showShare, setShowShare] = useState(false);

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

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" asChild className="pl-0 hover:bg-transparent hover:text-primary">
        <Link href="/history">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to History
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
            style={{ boxShadow: "0 0 8px rgba(16,185,129,0.2)" }}>
            <ShieldCheck className="w-3.5 h-3.5" />
            AI Verified
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
              <div className="text-sm font-medium text-muted-foreground">Total Reps</div>
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
              <div className="text-sm font-medium text-muted-foreground">Avg Form Score</div>
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
              <div className="text-sm font-medium text-muted-foreground">Duration</div>
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
                Saved Clip
              </CardTitle>
              <div className="flex items-center gap-3">
                {expires !== null && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="w-3 h-3" />
                    Expires in {expires} day{expires !== 1 ? "s" : ""}
                  </span>
                )}
                {session.isVerified && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => setShowShare(true)}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share to Community
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ClipPlayer objectPath={clip.objectPath} />
            <p className="text-[11px] text-muted-foreground mt-2">
              Loops automatically · tap to play / pause · expires in {expires ?? 0} day{expires !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      ) : session.isVerified && session.logType === "ai" ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Video className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No clip saved for this session. Use{" "}
              <span className="text-foreground font-medium">"Save to History"</span>{" "}
              on the POV Review screen after your next set.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Form score chart */}
      {session.reps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Form Score by Rep</CardTitle>
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
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Share sheet — repost mode (existingObjectPath, no blob needed) */}
      {showShare && clip && (
        <ShareToFeedSheet
          exerciseName={session.exerciseName}
          isAiVerified={session.isVerified ?? false}
          sessionId={id}
          existingObjectPath={clip.objectPath}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
