import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useListExercises, useCreateSession, useUpdateSession, useCreateRep } from "@workspace/api-client-react";
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Play, Square, FlaskConical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getExerciseConfig, type Phase, type Landmark } from "@/lib/exercise-registry";

export function Workout() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const { data: exercises } = useListExercises();

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");

  // Pre-select exercise from query param: /workout?exercise=Push-Up
  useEffect(() => {
    if (!exercises || selectedExerciseId) return;
    const params = new URLSearchParams(search);
    const name = params.get("exercise");
    if (!name) return;
    const match = exercises.find(
      (e) => e.name.toLowerCase() === name.toLowerCase(),
    );
    if (match) setSelectedExerciseId(match.id.toString());
  }, [exercises, search, selectedExerciseId]);

  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [reps, setReps] = useState(0);
  const [formScore, setFormScore] = useState(100);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isSavingTest, setIsSavingTest] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);

  const stateRef = useRef({
    phase: "up",
    repCount: 0,
    lastSpokenTime: 0,
    sessionStartTime: 0,
    sessionId: 0,
    repFormScores: [] as number[],
    lastRepTime: 0,
  });

  const createSession = useCreateSession();
  const updateSession = useUpdateSession();
  const createRep = useCreateRep();

  const speak = useCallback((text: string) => {
    const now = Date.now();
    if (now - stateRef.current.lastSpokenTime < 4000) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 0.95;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
    stateRef.current.lastSpokenTime = now;
  }, []);

  useEffect(() => {
    async function loadModel() {
      setIsModelLoading(true);
      let vision;
      try {
        vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
      } catch (err) {
        console.error("Failed to load MediaPipe WASM", err);
        setIsModelLoading(false);
        toast({
          title: "Pose tracking unavailable",
          description: "Could not load the vision library. Check your connection.",
          variant: "destructive",
        });
        return;
      }

      const modelAssetPath =
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

      // Try GPU first, fall back to CPU silently
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
        } catch (err) {
          console.warn(`MediaPipe delegate "${delegate}" failed, trying next…`, err);
        }
      }

      // Both delegates failed
      setIsModelLoading(false);
      toast({
        title: "Pose tracking unavailable",
        description: "Your device does not support real-time pose detection. Use Test Mode instead.",
      });
    }
    loadModel();
    return () => {
      landmarkerRef.current?.close();
    };
  }, [toast]);

  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
      });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    } catch (err) {
      console.error("Camera error", err);
      toast({
        title: "Camera error",
        description: "Could not access camera. Check browser permissions.",
        variant: "destructive",
      });
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream)
        .getTracks()
        .forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  };

  const predictWebcam = () => {
    if (!videoRef.current || !canvasRef.current || !landmarkerRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;

      // Video must be fully loaded with real dimensions before MediaPipe can process it
      if (
        video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        if (isWorkoutActive) requestRef.current = requestAnimationFrame(predictWebcam);
        return;
      }

      // Keep canvas in sync with the actual video resolution
      if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      let results;
      try {
        const startTimeMs = performance.now();
        results = landmarkerRef.current.detectForVideo(video, startTimeMs);
      } catch (err) {
        console.warn("Pose detection frame error (skipping frame):", err);
        if (isWorkoutActive) requestRef.current = requestAnimationFrame(predictWebcam);
        return;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks?.length > 0) {
        const drawingUtils = new DrawingUtils(ctx);
        for (const landmark of results.landmarks) {
          drawingUtils.drawLandmarks(landmark, {
            radius: 3,
            color: "#00FF00",
            lineWidth: 2,
          });
          drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {
            color: "#00FF00",
            lineWidth: 2,
          });
        }
        processFrame(results.landmarks[0]);
      }
      ctx.restore();
    }

    if (isWorkoutActive) {
      requestRef.current = requestAnimationFrame(predictWebcam);
    }
  };

  const processFrame = (landmarks: Landmark[]) => {
    const exercise = exercises?.find((e) => e.id.toString() === selectedExerciseId);
    if (!exercise) return;

    const config = getExerciseConfig(exercise.name);
    if (!config) return;

    const {
      newPhase,
      repCounted,
      repQuality,
      formScore: rawScore,
      audioCue,
    } = config.processFrame(landmarks, stateRef.current.phase as Phase);

    stateRef.current.phase = newPhase;

    if (repCounted) {
      const newRepCount = stateRef.current.repCount + 1;
      stateRef.current.repCount = newRepCount;
      setReps(newRepCount);

      const duration = Date.now() - stateRef.current.lastRepTime;
      stateRef.current.lastRepTime = Date.now();
      stateRef.current.repFormScores.push(rawScore);

      createRep.mutate({
        sessionId: stateRef.current.sessionId,
        data: {
          repNumber: newRepCount,
          formScore: Math.round(rawScore),
          durationMs: duration > 0 ? duration : null,
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
    } else if (audioCue) {
      speak(audioCue);
    }

    setFormScore((prev) => prev * 0.9 + rawScore * 0.1);
  };

  useEffect(() => {
    if (isWorkoutActive) {
      startCamera().then(() => {
        requestRef.current = requestAnimationFrame(predictWebcam);
      });
    } else {
      cancelAnimationFrame(requestRef.current);
      stopCamera();
    }
    return () => {
      cancelAnimationFrame(requestRef.current);
      stopCamera();
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
      const selectedExercise = exercises?.find((e) => e.id.toString() === selectedExerciseId);
      const config = selectedExercise ? getExerciseConfig(selectedExercise.name) : null;
      stateRef.current = {
        phase: config?.initialPhase ?? "up",
        repCount: 0,
        lastSpokenTime: Date.now(),
        sessionStartTime: Date.now(),
        sessionId: session.id,
        repFormScores: [],
        lastRepTime: Date.now(),
      };
      setReps(0);
      setFormScore(100);
      setIsWorkoutActive(true);
      speak("Workout started. Let's go.");
    } catch {
      toast({ title: "Error", description: "Could not start session.", variant: "destructive" });
    }
  };

  const handleStop = async () => {
    setIsWorkoutActive(false);
    speak("Workout complete.");

    if (stateRef.current.sessionId) {
      const avgScore =
        stateRef.current.repFormScores.length > 0
          ? stateRef.current.repFormScores.reduce((a, b) => a + b, 0) /
            stateRef.current.repFormScores.length
          : formScore;

      try {
        await updateSession.mutateAsync({
          id: stateRef.current.sessionId,
          data: {
            completedAt: new Date().toISOString(),
            totalReps: stateRef.current.repCount,
            avgFormScore: Math.round(avgScore),
          },
        });
        setLocation(`/session/${stateRef.current.sessionId}`);
      } catch {
        toast({ title: "Save error", description: "Failed to save session.", variant: "destructive" });
      }
    }
  };

  /**
   * Saves a synthetic workout entry with realistic fake reps so
   * charts and history have something to display immediately —
   * no camera required.
   */
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

      const repCount = 12 + Math.floor(Math.random() * 6);
      const baseScore = 65 + Math.floor(Math.random() * 25);
      const exercise = exercises?.find((e) => e.id.toString() === selectedExerciseId);
      const cues = exercise?.coachingCues ?? [];

      for (let i = 1; i <= repCount; i++) {
        const score = Math.min(100, baseScore + Math.random() * 10 - 5);
        await createRep.mutateAsync({
          sessionId: session.id,
          data: {
            repNumber: i,
            formScore: Math.round(score * 10) / 10,
            durationMs: 1800 + Math.floor(Math.random() * 800),
            feedbackGiven: score < 75 && cues.length ? cues[Math.floor(Math.random() * cues.length)] : null,
          },
        });
      }

      const avgScore = baseScore + Math.random() * 5;
      await updateSession.mutateAsync({
        id: session.id,
        data: {
          completedAt: new Date().toISOString(),
          totalReps: repCount,
          avgFormScore: Math.round(avgScore * 10) / 10,
        },
      });

      toast({ title: "Workout saved!", description: `${repCount} reps logged with ${Math.round(avgScore)} avg form.` });
      setLocation(`/session/${session.id}`);
    } catch {
      toast({ title: "Error", description: "Could not save test workout.", variant: "destructive" });
    } finally {
      setIsSavingTest(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white relative">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <Button
          variant="ghost"
          onClick={() => setLocation("/")}
          className="text-white hover:bg-white/20"
        >
          Cancel
        </Button>
        {!isWorkoutActive && (
          <div className="w-56">
            <Select
              value={selectedExerciseId}
              onValueChange={setSelectedExerciseId}
              disabled={isModelLoading}
            >
              <SelectTrigger className="bg-black/50 border-white/20 text-white">
                <SelectValue
                  placeholder={isModelLoading ? "Loading model..." : "Select Exercise"}
                />
              </SelectTrigger>
              <SelectContent>
                {exercises?.map((ex) => (
                  <SelectItem key={ex.id} value={ex.id.toString()}>
                    {ex.name}
                  </SelectItem>
                ))}
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
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none"
        />

        {/* Live HUD */}
        {isWorkoutActive && (
          <div className="absolute bottom-24 left-0 right-0 px-8 flex justify-between items-end pointer-events-none">
            <div className="flex flex-col items-center">
              <span className="text-sm font-mono text-white/70 uppercase tracking-widest">
                Reps
              </span>
              <span className="text-8xl font-black text-primary leading-none tracking-tighter drop-shadow-lg">
                {reps}
              </span>
            </div>

            <div className="flex flex-col items-center w-28">
              <span className="text-sm font-mono text-white/70 uppercase tracking-widest mb-2">
                Form
              </span>
              <div className="w-full h-28 bg-black/40 rounded-full border border-white/10 relative overflow-hidden flex flex-col justify-end p-1">
                <div
                  className="w-full rounded-full transition-all duration-200"
                  style={{
                    height: `${formScore}%`,
                    backgroundColor:
                      formScore > 80
                        ? "hsl(var(--primary))"
                        : formScore > 50
                        ? "#eab308"
                        : "#ef4444",
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
                  Position your camera so your full body is visible.
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
                    Saves a synthetic workout entry with realistic rep data directly to the database — no camera needed. Use this to populate your charts and history immediately.
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
