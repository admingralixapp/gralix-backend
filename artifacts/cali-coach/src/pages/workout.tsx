import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useListExercises, useListSessions, useCreateSession, useUpdateSession, useCreateRep } from "@workspace/api-client-react";
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Play, Square, FlaskConical, Ghost } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getExerciseConfig, type Phase, type Landmark } from "@/lib/exercise-registry";
import { speak as voiceSpeak, cancelSpeech } from "@/lib/voice-service";
import { evaluateSkillTree, type EvaluatedSkill, type SessionSummary } from "@/lib/skill-tree";
import { SessionResults, type SessionResultsProps } from "@/components/session-results";
import {
  getGhostConfig,
  getPhaseConfig,
  computeGhostLandmarks,
  computeAnimatedGhostLandmarks,
  calcSyncPct,
  drawGhostSkeleton,
  type GhostExerciseConfig,
} from "@/lib/ghost-poses";

// ─── Exercise menu ────────────────────────────────────────────────────────────

const EXERCISE_CATEGORIES = [
  {
    label: "Push",
    exercises: [
      { dbName: "Wall Push-Up",    label: "Wall Push-Up (Lv.1)" },
      { dbName: "Incline Push-Up", label: "Incline Push-Up (Lv.2)" },
      { dbName: "Knee Push-Up",    label: "Knee Push-Up (Lv.3)" },
      { dbName: "Push-Up",         label: "Full Push-Up (Lv.4)" },
      { dbName: "Diamond Push-Up", label: "Diamond Push-Up (Lv.5)" },
    ],
  },
  {
    label: "Pull — Foundation",
    exercises: [
      { dbName: "Scapular Shrugs",   label: "Scapular Shrugs (Lv.1)" },
      { dbName: "Australian Rows",   label: "Australian Rows (Lv.2)" },
      { dbName: "Negative Pull-Ups", label: "Negative Pull-Ups (Lv.3)" },
      { dbName: "Pull-Up",           label: "Full Pull-Ups (Lv.4)" },
    ],
  },
  {
    label: "Pull — Static Path 🧲",
    exercises: [
      { dbName: "Tuck Front Lever",     label: "Tuck Front Lever (Lv.3)" },
      { dbName: "Straddle Front Lever", label: "Straddle Front Lever (Lv.4)" },
      { dbName: "Full Front Lever",     label: "Full Front Lever (Lv.5)" },
    ],
  },
  {
    label: "Pull — Explosive Path ⚡",
    exercises: [
      { dbName: "Explosive Pull-Up", label: "Explosive Pull-Ups (Lv.3)" },
      { dbName: "Muscle-Up",         label: "Muscle-Up (Lv.4–5)" },
    ],
  },
  {
    label: "Legs",
    exercises: [
      { dbName: "Assisted Squat", label: "Assisted Squat (Lv.1)" },
      { dbName: "Squat",          label: "Air Squat (Lv.2)" },
      { dbName: "Archer Squat",   label: "Archer Squat (Lv.3)" },
      { dbName: "Nordic Curls",   label: "Nordic Curls (Lv.4)" },
      { dbName: "Pistol Squat",   label: "Pistol Squat (Lv.5)" },
    ],
  },
  {
    label: "Core",
    exercises: [
      { dbName: "Plank",             label: "Plank (Static)" },
      { dbName: "Dragon Flag",       label: "Dragon Flag (Static, Lv.4)" },
      { dbName: "Human Flag",        label: "Human Flag (Static, Lv.5)" },
      { dbName: "Lunge",             label: "Lunge" },
      { dbName: "Burpee",            label: "Burpee" },
      { dbName: "Dip",               label: "Dip" },
      { dbName: "Handstand Push-Up", label: "Handstand Push-Up (Lv.5)" },
    ],
  },
] as const;

// ─── Sync thresholds ──────────────────────────────────────────────────────────

/** Rep / timer only progress when sync is at or above this value. */
const SYNC_GATE = 85;
/** Voice "get back in position" fires when sync drops below this for >1.5 s. */
const SYNC_VOICE_THRESHOLD = 80;
/** Animation cycle for the ghost in rep exercises (ms per full up→down→up). */
const GHOST_CYCLE_MS = 4000;

export function Workout() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { data: exercises } = useListExercises();

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [sessionResults, setSessionResults] = useState<Omit<SessionResultsProps, "onClose"> | null>(null);

  const { data: sessionHistory } = useListSessions(
    { limit: 500, offset: 0 },
    { query: { queryKey: ["/api/sessions", { limit: 500 }] } },
  );

  useEffect(() => {
    if (!exercises || selectedExerciseId) return;
    const params = new URLSearchParams(search);
    const name = params.get("exercise");
    if (!name) return;
    const match = exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (match) setSelectedExerciseId(match.id.toString());
  }, [exercises, search, selectedExerciseId]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [reps, setReps] = useState(0);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [isInActiveZone, setIsInActiveZone] = useState(false);
  const [formScore, setFormScore] = useState(100);
  const [syncPct, setSyncPct] = useState(100);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isSavingTest, setIsSavingTest] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const landmarkerRef      = useRef<PoseLandmarker | null>(null);
  const requestRef         = useRef<number>(0);
  const lastVideoTimeRef   = useRef<number>(-1);
  const workoutStartMsRef  = useRef<number>(0); // for ghost animation timing

  const stateRef = useRef({
    phase:            "up" as Phase,
    repCount:         0,
    lastSpokenTime:   0,
    sessionStartTime: 0,
    sessionId:        0,
    repFormScores:    [] as number[],
    lastRepTime:      0,
    // Static hold timer
    holdSeconds:      0,
    lastHoldTickMs:   0,
    holdActive:       false,
    lastHoldSpeakSec: -1,
    // Ghost sync
    bestSyncPct:      0,
    lastSyncDropMs:   0, // timestamp when sync first dropped below threshold
  });

  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const createRep     = useCreateRep();

  // ── Voice helper ───────────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    const now = Date.now();
    if (now - stateRef.current.lastSpokenTime < 4000) return;
    stateRef.current.lastSpokenTime = now;
    voiceSpeak(text);
  }, []);

  // ── Separate voice channel for sync drop (own throttle) ───────────────────
  const lastSyncVoiceRef = useRef<number>(0);
  const speakSyncDrop = useCallback(() => {
    const now = Date.now();
    if (now - lastSyncVoiceRef.current < 5000) return;
    lastSyncVoiceRef.current = now;
    voiceSpeak("Get back into position to continue.");
  }, []);

  // ── Load MediaPipe model ───────────────────────────────────────────────────
  useEffect(() => {
    async function loadModel() {
      setIsModelLoading(true);
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
      } catch {
        setIsModelLoading(false);
        toast({ title: "Pose tracking unavailable", description: "Could not load the vision library. Check your connection.", variant: "destructive" });
        return;
      }

      const modelAssetPath = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

      for (const delegate of ["GPU", "CPU"] as const) {
        try {
          const landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath, delegate },
            runningMode: "VIDEO",
            numPoses: 1,
          });
          landmarkerRef.current = landmarker;
          setIsModelLoading(false);
          return;
        } catch {
          // try next delegate
        }
      }

      setIsModelLoading(false);
      toast({ title: "Pose tracking unavailable", description: "Your device does not support real-time pose detection. Use Test Mode instead." });
    }
    loadModel();
    return () => { landmarkerRef.current?.close(); };
  }, [toast]);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
      });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    } catch {
      toast({ title: "Camera error", description: "Could not access camera. Check browser permissions.", variant: "destructive" });
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  // ── processFrame ───────────────────────────────────────────────────────────
  /**
   * Called every animation frame when MediaPipe detects landmarks.
   * ghostConfig: the current exercise's ghost config (may be null).
   * ghostLandmarks: phase-matched ideal ghost (for sync calculation).
   * currentSyncPct: sync score computed from user vs ghost (0-100).
   */
  const processFrame = useCallback((
    landmarks: Landmark[],
    ghostLandmarks: Landmark[],
    ghostConfig: GhostExerciseConfig | null,
    currentSyncPct: number,
  ) => {
    const exercise = exercises?.find(e => e.id.toString() === selectedExerciseId);
    if (!exercise) return;

    const config = getExerciseConfig(exercise.name);
    if (!config) return;

    const result = config.processFrame(landmarks, stateRef.current.phase as Phase);
    stateRef.current.phase = result.newPhase;

    // ── Blended form score (50% angle-based, 50% ghost sync) ─────────────────
    const blendedScore = ghostConfig
      ? Math.round((result.formScore + currentSyncPct) / 2)
      : result.formScore;

    // ── Sync tracking & voice ────────────────────────────────────────────────
    const synced = currentSyncPct >= SYNC_GATE;
    const now    = Date.now();

    if (!synced) {
      if (stateRef.current.lastSyncDropMs === 0) {
        stateRef.current.lastSyncDropMs = now;
      } else if (now - stateRef.current.lastSyncDropMs > 1500) {
        speakSyncDrop();
      }
    } else {
      stateRef.current.lastSyncDropMs = 0;
    }

    stateRef.current.bestSyncPct = Math.max(stateRef.current.bestSyncPct, currentSyncPct);
    setSyncPct(Math.round(currentSyncPct));

    if (config.isStatic) {
      // ── Static Hold Timer ────────────────────────────────────────────────
      // Timer only ticks when BOTH in zone AND synced with ghost
      const holdNow = result.isHoldActive === true && synced;

      if (holdNow && stateRef.current.lastHoldTickMs > 0) {
        const delta   = (now - stateRef.current.lastHoldTickMs) / 1000;
        stateRef.current.holdSeconds += delta;
        const totalSec = Math.floor(stateRef.current.holdSeconds);
        setHoldSeconds(totalSec);

        if (
          totalSec > 0 &&
          totalSec % 5 === 0 &&
          totalSec !== stateRef.current.lastHoldSpeakSec
        ) {
          stateRef.current.lastHoldSpeakSec = totalSec;
          speak(`${totalSec} seconds. Stay strong.`);
        }
      }

      if (holdNow && !stateRef.current.holdActive) {
        speak("Perfect sync — hold it.");
      } else if (!holdNow && stateRef.current.holdActive) {
        if (!synced) {
          // sync drop already handled above — don't double-speak
        } else {
          speak(result.audioCue ?? "Adjust your position.");
        }
      }

      stateRef.current.holdActive    = holdNow;
      stateRef.current.lastHoldTickMs = holdNow ? now : 0;
      setIsInActiveZone(holdNow);

      stateRef.current.repFormScores.push(blendedScore);
      setFormScore(prev => prev * 0.9 + blendedScore * 0.1);
    } else {
      // ── Standard rep counting ─────────────────────────────────────────────
      const { repCounted, repQuality, audioCue } = result;

      // Rep only counts when the user is synced with the ghost
      if (repCounted && synced) {
        const newRepCount = stateRef.current.repCount + 1;
        stateRef.current.repCount  = newRepCount;
        setReps(newRepCount);

        const duration = now - stateRef.current.lastRepTime;
        stateRef.current.lastRepTime = now;
        stateRef.current.repFormScores.push(blendedScore);

        createRep.mutate({
          sessionId: stateRef.current.sessionId,
          data: {
            repNumber:    newRepCount,
            formScore:    blendedScore,
            durationMs:   duration > 0 ? duration : null,
            feedbackGiven: audioCue ?? null,
          },
        });

        if (repQuality === "incomplete") {
          speak("Incomplete rep — go deeper next time");
        } else if (newRepCount % 5 === 0) {
          speak(`${newRepCount} reps. Keep it up!`);
        } else {
          speak("Good rep");
        }
      } else if (repCounted && !synced) {
        // Rep completed but out of sync — don't count it
        speak("Match the ghost to earn that rep.");
      } else if (audioCue) {
        speak(audioCue);
      }

      setFormScore(prev => prev * 0.9 + blendedScore * 0.1);
    }
  }, [exercises, selectedExerciseId, speak, speakSyncDrop, createRep]);

  // ── Main camera loop ───────────────────────────────────────────────────────
  const predictWebcam = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !landmarkerRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    if (!ctx) return;

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;

      if (
        video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
      }

      if (canvas.width  !== video.videoWidth)  canvas.width  = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      let results;
      try {
        results = landmarkerRef.current.detectForVideo(video, performance.now());
      } catch {
        requestRef.current = requestAnimationFrame(predictWebcam);
        return;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks?.length > 0) {
        const userLandmarks = results.landmarks[0];

        // ── Ghost: find config for current exercise ────────────────────────
        const exerciseName  = exercises?.find(e => e.id.toString() === selectedExerciseId)?.name ?? "";
        const ghostConfig   = exerciseName ? getGhostConfig(exerciseName) : null;
        const currentPhase  = stateRef.current.phase;

        // ── Phase-matched ghost (for sync calculation) ─────────────────────
        let phasedGhostLandmarks: Landmark[] = userLandmarks;
        if (ghostConfig) {
          const phaseConfig      = getPhaseConfig(ghostConfig, currentPhase);
          phasedGhostLandmarks   = computeGhostLandmarks(userLandmarks, phaseConfig.corrections);
        }

        // ── Sync score ────────────────────────────────────────────────────
        let currentSyncPct = 100;
        if (ghostConfig) {
          const phaseConfig  = getPhaseConfig(ghostConfig, currentPhase);
          currentSyncPct     = calcSyncPct(userLandmarks, phasedGhostLandmarks, phaseConfig.keyLandmarks);
        }

        // ── Animated ghost (visual, independent timing) ───────────────────
        if (ghostConfig) {
          const elapsed    = Date.now() - workoutStartMsRef.current;
          const cyclePos   = (elapsed % GHOST_CYCLE_MS) / GHOST_CYCLE_MS; // 0 → 1
          // smooth sine wave 0→1→0 for up→down→up
          const t          = Math.sin(cyclePos * Math.PI * 2) * 0.5 + 0.5;
          const animGhost  = computeAnimatedGhostLandmarks(userLandmarks, ghostConfig, t);
          drawGhostSkeleton(ctx, animGhost, canvas.width, canvas.height, currentSyncPct);
        }

        // ── User skeleton (green, full opacity, drawn on top of ghost) ────
        const drawingUtils = new DrawingUtils(ctx);
        drawingUtils.drawLandmarks(userLandmarks, { radius: 3, color: "#00FF00", lineWidth: 2 });
        drawingUtils.drawConnectors(userLandmarks, PoseLandmarker.POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 });

        processFrame(userLandmarks, phasedGhostLandmarks, ghostConfig, currentSyncPct);
      }

      ctx.restore();
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  }, [exercises, selectedExerciseId, processFrame]);

  // ── Start / stop workout ───────────────────────────────────────────────────
  useEffect(() => {
    if (isWorkoutActive) {
      startCamera().then(() => {
        requestRef.current = requestAnimationFrame(predictWebcam);
      });
    } else {
      cancelAnimationFrame(requestRef.current);
      stopCamera();
      cancelSpeech();
    }
    return () => {
      cancelAnimationFrame(requestRef.current);
      stopCamera();
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWorkoutActive]);

  const handleStart = async () => {
    if (!selectedExerciseId) {
      toast({ title: "Select an exercise", description: "Pick an exercise before starting." });
      return;
    }
    try {
      const session = await createSession.mutateAsync({
        data: { exerciseId: parseInt(selectedExerciseId) },
      });
      const selectedExercise = exercises?.find(e => e.id.toString() === selectedExerciseId);
      const config = selectedExercise ? getExerciseConfig(selectedExercise.name) : null;

      stateRef.current = {
        phase:            config?.initialPhase ?? "up",
        repCount:         0,
        lastSpokenTime:   Date.now(),
        sessionStartTime: Date.now(),
        sessionId:        session.id,
        repFormScores:    [],
        lastRepTime:      Date.now(),
        holdSeconds:      0,
        lastHoldTickMs:   0,
        holdActive:       false,
        lastHoldSpeakSec: -1,
        bestSyncPct:      0,
        lastSyncDropMs:   0,
      };
      workoutStartMsRef.current = Date.now();
      setReps(0);
      setHoldSeconds(0);
      setIsInActiveZone(false);
      setFormScore(100);
      setSyncPct(100);
      setIsWorkoutActive(true);
      speak("Workout started. Match the ghost for credit. Let's go.");
    } catch {
      toast({ title: "Error", description: "Could not start session.", variant: "destructive" });
    }
  };

  const handleStop = async () => {
    setIsWorkoutActive(false);
    speak("Workout complete.");

    if (!stateRef.current.sessionId) return;

    const avgScore =
      stateRef.current.repFormScores.length > 0
        ? stateRef.current.repFormScores.reduce((a, b) => a + b, 0) / stateRef.current.repFormScores.length
        : formScore;

    const selectedExercise = exercises?.find(e => e.id.toString() === selectedExerciseId);
    const exerciseConfig   = selectedExercise ? getExerciseConfig(selectedExercise.name) : null;
    const isStatic         = exerciseConfig?.isStatic === true;

    const finalReps      = isStatic ? Math.round(stateRef.current.holdSeconds) : stateRef.current.repCount;
    const finalFormScore = Math.round(avgScore);
    const finalSessionId = stateRef.current.sessionId;
    const bestSync       = Math.round(stateRef.current.bestSyncPct);
    const exerciseName   = selectedExercise?.name ?? "Exercise";

    const history: SessionSummary[] = (sessionHistory ?? []).map(s => ({
      exerciseName: s.exerciseName ?? "",
      totalReps:    s.totalReps    ?? null,
      avgFormScore: s.avgFormScore ?? null,
      completedAt:  s.completedAt  ?? null,
    }));
    const prevEvaluated = evaluateSkillTree(history);

    try {
      await updateSession.mutateAsync({
        id:   finalSessionId,
        data: {
          completedAt:  new Date().toISOString(),
          totalReps:    finalReps,
          avgFormScore: finalFormScore,
        },
      });

      const newSession: SessionSummary = {
        exerciseName,
        totalReps:    finalReps,
        avgFormScore: finalFormScore,
        completedAt:  new Date().toISOString(),
      };
      const nextEvaluated = evaluateSkillTree([...history, newSession]);

      setSessionResults({
        exerciseName,
        totalReps:    finalReps,
        avgFormScore: finalFormScore,
        sessionId:    finalSessionId,
        bestSyncPct:  bestSync,
        prevEvaluated,
        nextEvaluated,
      });
    } catch {
      toast({ title: "Save error", description: "Failed to save session.", variant: "destructive" });
    }
  };

  /** Test mode: saves a synthetic workout entry without camera. */
  const handleSaveTestWorkout = async () => {
    if (!selectedExerciseId) {
      toast({ title: "Select an exercise", description: "Pick an exercise first." });
      return;
    }
    setIsSavingTest(true);
    try {
      const session = await createSession.mutateAsync({
        data: { exerciseId: parseInt(selectedExerciseId) },
      });

      const repCount  = 12 + Math.floor(Math.random() * 6);
      const baseScore = 65 + Math.floor(Math.random() * 25);
      const exercise  = exercises?.find(e => e.id.toString() === selectedExerciseId);
      const cues      = exercise?.coachingCues ?? [];

      for (let i = 1; i <= repCount; i++) {
        const score = Math.min(100, baseScore + Math.random() * 10 - 5);
        await createRep.mutateAsync({
          sessionId: session.id,
          data: {
            repNumber:    i,
            formScore:    Math.round(score * 10) / 10,
            durationMs:   1800 + Math.floor(Math.random() * 800),
            feedbackGiven: score < 75 && cues.length ? cues[Math.floor(Math.random() * cues.length)] : null,
          },
        });
      }

      const avgScore       = baseScore + Math.random() * 5;
      const finalFormScore = Math.round(avgScore * 10) / 10;

      const history: SessionSummary[] = (sessionHistory ?? []).map(s => ({
        exerciseName: s.exerciseName ?? "",
        totalReps:    s.totalReps    ?? null,
        avgFormScore: s.avgFormScore ?? null,
        completedAt:  s.completedAt  ?? null,
      }));
      const prevEvaluated = evaluateSkillTree(history);

      await updateSession.mutateAsync({
        id:   session.id,
        data: {
          completedAt:  new Date().toISOString(),
          totalReps:    repCount,
          avgFormScore: finalFormScore,
        },
      });

      const exerciseName = exercise?.name ?? "Exercise";
      const newSession: SessionSummary = {
        exerciseName,
        totalReps:    repCount,
        avgFormScore: finalFormScore,
        completedAt:  new Date().toISOString(),
      };
      const nextEvaluated = evaluateSkillTree([...history, newSession]);

      setSessionResults({
        exerciseName,
        totalReps:    repCount,
        avgFormScore: finalFormScore,
        sessionId:    session.id,
        bestSyncPct:  undefined, // no ghost in test mode
        prevEvaluated,
        nextEvaluated,
      });
    } catch {
      toast({ title: "Error", description: "Could not save test workout.", variant: "destructive" });
    } finally {
      setIsSavingTest(false);
    }
  };

  // ── Derived flags ──────────────────────────────────────────────────────────
  const selectedExerciseConfig = (() => {
    const exercise = exercises?.find(e => e.id.toString() === selectedExerciseId);
    return exercise ? getExerciseConfig(exercise.name) : null;
  })();
  const isStaticExercise = selectedExerciseConfig?.isStatic === true;

  const hasGhostConfig = (() => {
    const name = exercises?.find(e => e.id.toString() === selectedExerciseId)?.name;
    return name ? getGhostConfig(name) !== null : false;
  })();

  function formatHoldTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}`;
  }

  // ── Sync badge color ───────────────────────────────────────────────────────
  const syncColor =
    syncPct >= 90 ? { bg: "rgba(34,197,94,0.2)",  border: "rgba(34,197,94,0.5)",  text: "#86efac" } :
    syncPct >= 75 ? { bg: "rgba(234,179,8,0.2)",  border: "rgba(234,179,8,0.5)",  text: "#fde047" } :
                    { bg: "rgba(239,68,68,0.18)",  border: "rgba(239,68,68,0.5)",  text: "#fca5a5" };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-black text-white relative">

      {/* Session Results overlay */}
      {sessionResults && (
        <SessionResults
          {...sessionResults}
          onClose={() => setSessionResults(null)}
        />
      )}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="text-white hover:bg-white/20"
        >
          Cancel
        </Button>
        {!isWorkoutActive && (
          <div className="w-64">
            <Select value={selectedExerciseId} onValueChange={setSelectedExerciseId} disabled={isModelLoading}>
              <SelectTrigger className="bg-black/50 border-white/20 text-white">
                <SelectValue placeholder={isModelLoading ? "Loading model..." : "Select Exercise"} />
              </SelectTrigger>
              <SelectContent className="max-h-96">
                {EXERCISE_CATEGORIES.map(cat => {
                  const items = cat.exercises
                    .map(entry => {
                      const dbEx = exercises?.find(e => e.name === entry.dbName);
                      return dbEx ? { ...entry, id: dbEx.id } : null;
                    })
                    .filter(Boolean) as Array<{ dbName: string; label: string; id: number }>;
                  if (items.length === 0) return null;
                  return (
                    <SelectGroup key={cat.label}>
                      <SelectLabel className="text-xs font-bold uppercase tracking-widest text-primary/80 px-2 py-1.5">
                        {cat.label}
                      </SelectLabel>
                      {items.map(item => (
                        <SelectItem key={item.id} value={item.id.toString()} className="pl-4">
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Video + Canvas */}
      <div className="flex-1 relative overflow-hidden bg-zinc-900">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover -scale-x-100"
          playsInline
          muted
        />
        {/* Single canvas holds both ghost (cyan) and user skeleton (green) */}
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none"
        />

        {/* Border glow: green/red based on active zone (static), or sync quality (reps) */}
        {isWorkoutActive && (
          <div
            className="absolute inset-0 pointer-events-none transition-all duration-300"
            style={{
              boxShadow: isStaticExercise
                ? (isInActiveZone
                    ? "inset 0 0 0 5px rgba(34,197,94,0.75)"
                    : "inset 0 0 0 5px rgba(239,68,68,0.55)")
                : (syncPct >= SYNC_GATE
                    ? "inset 0 0 0 4px rgba(0,212,255,0.5)"
                    : "inset 0 0 0 4px rgba(255,160,0,0.4)"),
            }}
          />
        )}

        {/* Ghost Mode indicator (top-right of camera, shown when workout active) */}
        {isWorkoutActive && hasGhostConfig && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-cyan-500/40 text-xs font-semibold text-cyan-300 select-none">
            <Ghost className="w-3.5 h-3.5" />
            Ghost Mode
          </div>
        )}

        {/* Live HUD */}
        {isWorkoutActive && (
          <div className="absolute bottom-24 left-0 right-0 px-8 flex justify-between items-end pointer-events-none">

            {/* Left: rep counter or hold timer */}
            {isStaticExercise ? (
              <div className="flex flex-col items-start gap-2">
                <span className="text-sm font-mono text-white/70 uppercase tracking-widest">
                  Hold Time
                </span>
                <span
                  className="text-8xl font-black leading-none tracking-tighter drop-shadow-lg"
                  style={{ color: isInActiveZone ? "#22c55e" : "#ef4444" }}
                >
                  {formatHoldTime(holdSeconds)}
                </span>
                <div
                  className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
                  style={{
                    backgroundColor: isInActiveZone ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
                    color:           isInActiveZone ? "#86efac" : "#fca5a5",
                    border: `1px solid ${isInActiveZone ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.5)"}`,
                  }}
                >
                  {isInActiveZone ? "● Synced — hold it" : "○ Match ghost position"}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-sm font-mono text-white/70 uppercase tracking-widest">Reps</span>
                <span className="text-8xl font-black text-primary leading-none tracking-tighter drop-shadow-lg">
                  {reps}
                </span>
              </div>
            )}

            {/* Centre: Ghost Sync badge (only when ghost config exists) */}
            {hasGhostConfig && (
              <div className="flex flex-col items-center gap-1 mb-1">
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
                  Ghost Sync
                </span>
                <div
                  className="text-4xl font-black tabular-nums leading-none"
                  style={{ color: syncColor.text }}
                >
                  {syncPct}%
                </div>
                <div
                  className="mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: syncColor.bg,
                    border:          `1px solid ${syncColor.border}`,
                    color:           syncColor.text,
                  }}
                >
                  {syncPct >= SYNC_GATE ? "● Locked In" : "○ Adjust"}
                </div>
              </div>
            )}

            {/* Right: form score bar */}
            <div className="flex flex-col items-center w-28">
              <span className="text-sm font-mono text-white/70 uppercase tracking-widest mb-2">Form</span>
              <div className="w-full h-28 bg-black/40 rounded-full border border-white/10 relative overflow-hidden flex flex-col justify-end p-1">
                <div
                  className="w-full rounded-full transition-all duration-200"
                  style={{
                    height: `${formScore}%`,
                    backgroundColor:
                      formScore > 80 ? "hsl(var(--primary))" :
                      formScore > 50 ? "#eab308" : "#ef4444",
                  }}
                />
              </div>
              <span className="mt-2 font-mono font-bold text-xl">
                {Math.round(formScore)}
              </span>
            </div>
          </div>
        )}

        {/* Pre-start overlay */}
        {!isWorkoutActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="text-center space-y-6 px-6 max-w-sm">
              <Activity className="w-16 h-16 text-primary mx-auto opacity-50" />
              <div>
                <h2 className="text-2xl font-bold mb-2">Ready to train?</h2>
                <p className="text-muted-foreground text-sm">
                  A Ghost Skeleton will show perfect form — sync your body with it to earn reps and hold time.
                </p>
              </div>

              <Button
                size="lg"
                className="w-48 h-14 text-xl rounded-full font-bold"
                onClick={handleStart}
                disabled={!selectedExerciseId || isModelLoading}
              >
                <Play className="w-6 h-6 mr-2 fill-current" />
                START
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs text-muted-foreground uppercase tracking-widest">
                  <span className="bg-black px-3">or</span>
                </div>
              </div>

              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm text-white/70 font-medium flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-primary" />
                    Complete Workout (Test Mode)
                  </div>
                  <p className="text-xs text-white/40 text-left">
                    Saves a synthetic workout entry directly to the database — no camera needed. Use this to populate charts and history.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-white/20 text-white hover:bg-white/10"
                    onClick={handleSaveTestWorkout}
                    disabled={!selectedExerciseId || isSavingTest}
                  >
                    {isSavingTest ? "Saving..." : "Save Test Workout"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Stop button */}
      {isWorkoutActive && (
        <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center bg-gradient-to-t from-black to-transparent">
          <Button
            variant="destructive"
            size="lg"
            className="w-48 h-14 text-xl font-bold rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)]"
            onClick={handleStop}
          >
            <Square className="w-6 h-6 mr-2 fill-current" />
            FINISH
          </Button>
        </div>
      )}
    </div>
  );
}
